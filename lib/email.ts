// lib/email.ts
// Guest order delivery mail. Server-only: reads the Gmail SMTP credentials from
// the environment. Never import this into a Client Component.

import nodemailer from "nodemailer"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Send the guest download link. Throws on missing configuration or SMTP
 * failure so the caller can release the delivery lease and retry later.
 */
export async function sendDownloadEmail(to: string, link: string): Promise<void> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) throw new Error("gmail not configured")

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  })

  const safeLink = escapeHtml(link)
  const subject = "আপনার ইবুক ডাউনলোড লিংক"
  const text = [
    "আপনার পেমেন্ট সফল হয়েছে।",
    "",
    "নিচের লিংক থেকে ইবুকটি ডাউনলোড করুন:",
    link,
    "",
    "লিংকটি আপনার অর্ডারের সাথে যুক্ত। অন্য কারও সাথে শেয়ার করবেন না।",
    "ডাউনলোডের কোনো মেয়াদ বা সীমা নেই।",
  ].join("\n")

  const html = [
    `<p>আপনার পেমেন্ট সফল হয়েছে।</p>`,
    `<p><a href="${safeLink}">ইবুকটি ডাউনলোড করুন</a></p>`,
    `<p style="color:#666;font-size:13px">লিংকটি আপনার অর্ডারের সাথে যুক্ত। অন্য কারও সাথে শেয়ার করবেন না। ডাউনলোডের কোনো মেয়াদ বা সীমা নেই।</p>`,
  ].join("")

  await transporter.sendMail({
    from: `"Pradipkumarwebsite" <${user}>`,
    to,
    subject,
    text,
    html,
  })
}

/**
 * Resend flow: one email listing every paid guest order's download link.
 */
export async function sendGuestLinksEmail(to: string, links: string[]): Promise<void> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) throw new Error("gmail not configured")

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  })

  const linkLines = links.map((l, i) => `${i + 1}. ${l}`).join("\n")
  const linkHtml = links
    .map((l) => `<li><a href="${escapeHtml(l)}">${escapeHtml(l)}</a></li>`)
    .join("")

  const subject = "আপনার ইবুক ডাউনলোড লিংকসমূহ"
  const text = [
    "আপনার পরিশোধিত অর্ডারগুলোর ডাউনলোড লিংক:",
    "",
    linkLines,
    "",
    "লিংকগুলো আপনার অর্ডারের সাথে যুক্ত। অন্য কারও সাথে শেয়ার করবেন না।",
    "ডাউনলোডের কোনো মেয়াদ বা সীমা নেই।",
  ].join("\n")

  const html = [
    `<p>আপনার পরিশোধিত অর্ডারগুলোর ডাউনলোড লিংক:</p>`,
    `<ol>${linkHtml}</ol>`,
    `<p style="color:#666;font-size:13px">লিংকগুলো আপনার অর্ডারের সাথে যুক্ত। অন্য কারও সাথে শেয়ার করবেন না। ডাউনলোডের কোনো মেয়াদ বা সীমা নেই।</p>`,
  ].join("")

  await transporter.sendMail({
    from: `"Pradipkumarwebsite" <${user}>`,
    to,
    subject,
    text,
    html,
  })
}
