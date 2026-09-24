-- ============================================
-- Chat System Tables (Text Only - No Images)
-- ============================================

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_group BOOLEAN DEFAULT FALSE,
    name VARCHAR(255),
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ,
    last_message_sender_id UUID
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    is_admin BOOLEAN DEFAULT FALSE,
    unread_messages INT DEFAULT 0,
    last_read_at TIMESTAMPTZ,
    UNIQUE(conversation_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_user ON conversation_participants(user_id);

-- ============================================
-- Enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations: users can only see their own
CREATE POLICY "Users can view their conversations"
    ON conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = conversations.id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create conversations"
    ON conversations FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their conversations"
    ON conversations FOR UPDATE
    USING (auth.uid() = created_by);

-- Participants
CREATE POLICY "Users can view participants"
    ON conversation_participants FOR SELECT
    USING (
        user_id = auth.uid()
    );

-- Helper function to check if user is conversation creator
CREATE OR REPLACE FUNCTION is_conversation_creator(conv_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    creator_uuid UUID;
BEGIN
    SELECT created_by INTO creator_uuid FROM conversations WHERE id = conv_id;
    RETURN creator_uuid = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow users to insert participants if they are the creator of the conversation
CREATE POLICY "Users can add participants"
    ON conversation_participants FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND is_conversation_creator(conversation_id)
    );

CREATE POLICY "Users can leave conversations"
    ON conversation_participants FOR DELETE
    USING (user_id = auth.uid());

-- Messages
CREATE POLICY "Users can view messages"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages"
    ON messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = conversation_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update messages"
    ON messages FOR UPDATE
    USING (sender_id = auth.uid());

CREATE POLICY "Users can delete messages"
    ON messages FOR DELETE
    USING (sender_id = auth.uid());

-- ============================================
-- Function: Update conversation last message
-- ============================================
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET
        last_message_preview = LEFT(NEW.content, 100),
        last_message_at = NEW.created_at,
        last_message_sender_id = NEW.sender_id,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();
