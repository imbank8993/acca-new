'use client'

export function ClerkInstallHint() {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <p className="font-medium">Copy/paste template setup</p>
      <p className="mt-1 text-muted-foreground">
        Install Clerk packages first:
      </p>
      <code className="mt-2 block rounded bg-background px-2 py-1 font-mono text-xs">
        pnpm add @clerk/nextjs @clerk/elements
      </code>
      <p className="mt-2 text-muted-foreground">
        Then wire <code>ClerkProvider</code> and server/client Clerk handlers in
        your app.
      </p>
    </div>
  )
}
