export type TextPlacement = { x: number; y: number; width: number; size: number; align: 'left' | 'center' | 'right'; color: string };
export type CertificateSigner = { id: string; name: string; title: string; print: boolean; nameLayout: TextPlacement; titleLayout: TextPlacement };
export type IdentityPlacement = TextPlacement & { visible: boolean; showLabel: boolean };
export type CertificateTemplate = {
    unit?: 'pt';
    page?: { width: number; height: number };
    signers?: CertificateSigner[];
    identityFields?: Record<string, IdentityPlacement>;
    assetId: string | null;
    name: TextPlacement;
    institution: TextPlacement;
    identities: TextPlacement;
    number: TextPlacement;
    qr: { x: number; y: number; size: number };
    visible: { institution: boolean; identities: boolean; number: boolean };
};
export const DEFAULT_TEMPLATE: CertificateTemplate = {
    assetId: null,
    name: { x: 10, y: 39, width: 80, size: 30, align: 'center', color: '#17335c' },
    institution: { x: 10, y: 48, width: 80, size: 16, align: 'center', color: '#17335c' },
    identities: { x: 12, y: 55, width: 76, size: 12, align: 'center', color: '#17335c' },
    number: { x: 10, y: 26, width: 80, size: 11, align: 'center', color: '#17335c' },
    qr: { x: 82, y: 72, size: 11 },
    visible: { institution: true, identities: true, number: true },
};
export type CertificateEvent = {
    id: string; owner_id: string; title: string; organizer: string; description: string; location: string;
    start_date: string; end_date: string; number_prefix: string; template: CertificateTemplate;
    revision: number; archived: boolean; total?: number; issued?: number;
};
export type Recipient = {
    id: string; name: string; institution: string; identities: Record<string, string>;
    status: 'draft' | 'issued' | 'revoked'; certificate_number: string | null; verify_token?: string;
    issued_at?: string; revoke_reason?: string;
};
export type Asset = { id: string; kind: 'template' | 'documentation' | 'correspondence'; filename: string; mime: string; is_public: boolean };
export type CertificateSnapshot = {
    event: Pick<CertificateEvent, 'title' | 'organizer' | 'description' | 'location' | 'start_date' | 'end_date'>;
    name: string; institution: string; identities: Record<string, string>; template: CertificateTemplate;
};
