# Privacy Policy

**Effective date:** *\[to be set when published]*
**Last updated:** *\[to be set when published]*

> ⚠️ **Draft.** This policy has **not** been reviewed by legal counsel.
> Before publishing, have a lawyer tailor it to your jurisdiction and
> current subprocessors. Retention windows, legal bases, and transfer
> mechanisms below are placeholders meant to be reviewed.

This Privacy Policy explains how Docspeare ("**Docspeare**", "**we**",
"**us**") collects, uses, and shares information when you use the
Docspeare website, product, and related services (the "**Service**").

---

## 1. Who we are

Docspeare is operated by *\[Docspeare legal entity name]*, located at
*\[registered address]*. You can reach us at
[hello@docspeare.com](mailto:hello@docspeare.com).

For the purposes of data protection law:

- When you sign up for Docspeare and submit content, **you are the
  controller** of any personal data contained in that content.
  Docspeare acts as a **processor** on your behalf.
- For account-level data (login, billing, support), **Docspeare is the
  controller**.

---

## 2. What data we collect

### a) Account data

When you sign in with Google OAuth, we receive from Google:

- Your name, email address, Google account ID, and profile picture URL.
- An OAuth access token and refresh token scoped to the permissions you
  grant.

### b) Workspace and content data

To provide the Service, Docspeare accesses and stores:

- Metadata about the Google Drive folder you connect (folder IDs,
  names, hierarchy).
- The contents of Google Docs in that folder (converted to
  structured HTML/markdown for rendering).
- Approval and publication history, page revisions, and comments.

We request the **minimum Google Drive scopes** required to read the
folder you explicitly connect. We do not read Drive files outside the
connected folder.

### c) Usage and device data

When you use the Service, we automatically collect:

- Log data (IP address, user agent, request paths, timestamps) as part
  of our hosting provider's standard request logging.
- Cookies and similar technologies strictly necessary to keep you
  signed in and route you to the right workspace (see section 9).

We do **not** currently run third-party product analytics or behavioral
tracking. If that changes, we will update this policy and notify you.

### d) Communications

If you email us or submit a support request, we retain the content of
that correspondence along with your email address.

### e) Billing data

If and when paid plans launch, payment is processed by *\[payment
provider, e.g. Stripe]*. Docspeare does **not** store full payment card
numbers; we retain a billing-contact email, invoice history, and the
last four digits + card brand returned by the provider.

---

## 3. How we use data

We use the data listed above to:

- Provide, maintain, and secure the Service.
- Authenticate you via Google and keep you signed in.
- Sync, render, and publish the documents you create.
- Enforce access controls (RBAC) and publication rules.
- Detect and prevent abuse, fraud, and security incidents.
- Respond to your support requests.
- Comply with legal obligations.

We do **not** sell personal data. We do **not** use your workspace
content to train AI models. We do not currently run behavioral
analytics or send marketing email.

---

## 4. Legal bases (EEA / UK users)

Where GDPR or UK GDPR applies, we rely on:

- **Contract** — to provide the Service you signed up for.
- **Legitimate interests** — to secure the Service, prevent abuse,
  understand usage, and communicate about the product.
- **Consent** — for optional analytics cookies and marketing emails.
- **Legal obligation** — to meet tax, accounting, and lawful-request
  requirements.

You can withdraw consent at any time without affecting prior processing.

---

## 5. AI features

Docspeare's AI agent runs in **bring-your-own-key** mode. When you
configure a provider (Anthropic, Google Gemini, Groq, or any
OpenAI-compatible endpoint), agent prompts and the content they include
are sent **from Docspeare directly to that provider** under your API
key and their terms.

- Docspeare does not retain the content of individual agent prompts
  beyond what's needed to show your recent chat history in-app.
- Docspeare does not share your workspace content with any AI provider
  unless you explicitly invoke the agent.

Please review the privacy terms of the AI provider you choose.

---

## 6. Subprocessors and third parties

We use the following subprocessors to run the Service:

| Subprocessor | Purpose                                        | Location                   |
| ------------ | ---------------------------------------------- | -------------------------- |
| Google LLC   | Sign-in (OAuth), Drive API, Docs API           | United States              |
| Vercel Inc.  | Application hosting and edge network           | United States, global edge |
| *\[DB host]* | Managed Postgres database                      | *\[region]*                |
| *\[AI providers you enable]* | Agent completions (only when you configure a provider and key) | Varies |

We update this list as subprocessors change. Material changes are
announced via in-product notice.

---

## 7. International transfers

The Service is operated from the United States and/or the European
Union depending on your region. If you access Docspeare from elsewhere,
your data may be transferred to, and processed in, countries other than
your own.

Where required, we rely on **Standard Contractual Clauses** (and the UK
addendum where applicable) for international transfers.

---

## 8. Data retention

- **Account data** — retained while your account is active and for up
  to **\[90 days]** after deletion, except where longer retention is
  required by law.
- **Workspace content** — retained while your workspace is active. When
  a workspace is deleted, content is removed from our production systems
  within **\[30 days]** and from backups within **\[90 days]**.
- **Logs** — retained for **\[up to 30 days]** as part of standard
  hosting request logs.
- **Billing records** — retained for **\[up to 7 years]** as required by
  tax law.

You can request earlier deletion in line with your rights below.

---

## 9. Cookies

Docspeare uses only:

- **Strictly necessary cookies** — required for sign-in and workspace
  routing. These cannot be disabled without breaking the Service.
- **Preference cookies** — remember UI settings like dark mode.

We do not currently use advertising or analytics cookies. You can
manage cookie preferences in your browser at any time.

---

## 10. Security

We apply industry-standard safeguards:

- TLS 1.2+ for data in transit.
- Encryption at rest for databases and backups.
- Least-privilege access to production systems, with audit logging.
- Mandatory multi-factor authentication for employees.
- Regular dependency and security scanning.

No system is perfectly secure. If you believe you've found a
vulnerability, email
[security@docspeare.com](mailto:security@docspeare.com).

---

## 11. Your rights

Subject to your location, you may have the right to:

- Access the personal data we hold about you.
- Correct inaccurate data.
- Delete your account and associated data.
- Export your workspace content.
- Object to, or restrict, certain processing.
- Lodge a complaint with your local data protection authority.

To exercise these rights, email
[privacy@docspeare.com](mailto:privacy@docspeare.com) from the address
on your account. We'll respond within the timelines required by
applicable law.

**Note for team members:** if we process your data only as a processor
on behalf of a workspace owner, please contact your workspace owner
first — they're best placed to action your request.

---

## 12. Children

Docspeare is not directed to, and does not knowingly collect data from,
anyone under the age of 16. If you believe a child has provided us
with data, email us and we'll delete it.

---

## 13. Changes to this policy

We may update this Privacy Policy from time to time. Material changes
will be announced in-product and/or by email at least **\[30 days]**
before they take effect. The "Last updated" date at the top always
reflects the current version.

---

## 14. Contact

**Privacy questions:** [privacy@docspeare.com](mailto:privacy@docspeare.com)
**General contact:** [hello@docspeare.com](mailto:hello@docspeare.com)
**Postal address:** *\[to be set]*

If you're in the EEA/UK and believe we are not handling your data
properly, you have the right to complain to your local supervisory
authority.
