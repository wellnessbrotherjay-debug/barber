// Email delivery via the local Postfix MTA (LOKI). Pipes RFC-822 messages to
// /usr/sbin/sendmail — the platform's only sanctioned email path (DKIM/SPF/
// DMARC are configured on @safetykat.com at the MTA level). No third-party
// email API (Resend/SendGrid/etc.) may ever be used here.
//
// Design constraints:
// - Best-effort: email must NEVER fail or slow the parent action. All errors
//   are logged and swallowed; sends are fire-and-forget.
// - Dev-safe: when /usr/sbin/sendmail doesn't exist (local dev on macOS),
//   sends become a logged no-op.
// - Body is base64 content-transfer-encoded so multi-byte and long lines
//   survive every MTA hop intact.

import { spawn } from 'child_process';
import { existsSync } from 'fs';

const SENDMAIL = '/usr/sbin/sendmail';
// Who the mail comes from is configuration, not a constant: a different
// deployment sends as itself, and nothing has to be edited to do it.
const ENVELOPE_FROM = process.env.MAIL_FROM;
// One source: the display name is built from the configured address, never a
// second setting that can disagree with it.
const FROM = ENVELOPE_FROM ? `Shorter <${ENVELOPE_FROM}>` : '';

const sendmailAvailable = existsSync(SENDMAIL);

function base64Wrap(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
}

export function sendEmail(to: string, subject: string, bodyText: string): void {
  if (!to || !to.includes('@')) return;
  if (!ENVELOPE_FROM) {
    console.error('[mailer] MAIL_FROM is not set - refusing to send as an address nobody configured');
    return;
  }
  if (!sendmailAvailable) {
    console.log(`[mailer] sendmail not present — skipping email to ${to} ("${subject}")`);
    return;
  }
  try {
    const message = [
      `From: ${FROM}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      base64Wrap(bodyText),
      '',
    ].join('\r\n');

    const child = spawn(SENDMAIL, ['-f', ENVELOPE_FROM, '-t'], { stdio: ['pipe', 'ignore', 'pipe'] });
    child.stderr.on('data', (d) => console.error('[mailer] sendmail stderr:', d.toString().trim()));
    child.on('error', (err) => console.error('[mailer] sendmail spawn failed:', err.message));
    child.on('close', (code) => {
      if (code !== 0) console.error(`[mailer] sendmail exited ${code} for ${to}`);
    });
    child.stdin.write(message);
    child.stdin.end();
  } catch (err) {
    console.error('[mailer] non-fatal email failure:', (err as Error).message);
  }
}
