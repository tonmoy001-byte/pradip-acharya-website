# Deployment Checklist

Safe checklist for deploying the reviewed commit. Do not include secret values.

## Before deploy

1. Confirm the Git working tree is clean.
2. Run `npm run typecheck`.
3. Run `npm test`.
4. Run `npm run build -- --webpack`.
5. Run `git diff --check`.
6. Record the exact commit SHA to be deployed.

## Production runtime variables

Confirm these exist in the runtime that actually runs Next.js. Report only configured/missing; never print values.

```text
APP_URL
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_INSFORGE_URL
NEXT_PUBLIC_INSFORGE_ANON_KEY
INSFORGE_SERVICE_KEY
NAGORIKPAY_API_KEY
NAGORIKPAY_BASE_URL
NAGORIKPAY_WEBHOOK_SECRET
GMAIL_USER
GMAIL_APP_PASSWORD
GUEST_RATE_LIMIT_SALT
```

Expected values:

```text
APP_URL=https://pradipuponnash.com
NEXT_PUBLIC_SITE_URL=https://pradipuponnash.com
NEXT_PUBLIC_INSFORGE_URL=https://cpd9mnqf.ap-southeast.insforge.app
```

## Email provider

- The current application uses Gmail SMTP.
- Resend is not required unless the email implementation is migrated.
- `GMAIL_USER` and `GMAIL_APP_PASSWORD` must be configured in the actual application runtime.
- InsForge SMTP settings are separate and are not used by `lib/email.ts`.

## Rate-limit salt

Generate separately; never commit it:

```bash
openssl rand -hex 32
```

Store the result as `GUEST_RATE_LIMIT_SALT`.

## Deploy

1. Deploy the exact reviewed commit.
2. Record the deployed commit SHA.
3. Verify public routes:
   - `/`
   - `/checkout`
   - `/payment/success`
   - `/guest/recover`
   - `/api/payment/verify` returns validation error without transaction ID
   - `/api/payment/webhook` accepts only POST
4. Verify Cloudflare `www` handling separately:
   - `curl -I https://www.pradipuponnash.com/`
   - Expected: `200` or `301` to `https://pradipuponnash.com/`
5. Perform a controlled owner/test payment only after all checks pass.

## Do not

- Do not print or commit secrets.
- Do not apply database migrations during deployment.
- Do not create a real customer order for verification.
- Do not claim production payment works unless a controlled payment was actually performed.