const net = require("net");
const tls = require("tls");
const dns = require("dns");

const BLOCKED_EMAILS = new Set(["tatitop07@gmail.com"]);
const DEFAULT_SENDER_EMAIL = "itsupport@thaichamber.or.th";

function isBlockedEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  return !clean || BLOCKED_EMAILS.has(clean);
}

function encodeMimeWord(str) {
  return "=?UTF-8?B?" + Buffer.from(String(str || ""), "utf8").toString("base64") + "?=";
}

function normalizeSmtpPassword(rawPass) {
  const trimmed = String(rawPass || "").trim();
  // Google App Passwords are 16 letters often copied as 4 groups of 4 chars ("xxxx xxxx xxxx xxxx")
  if (/^[a-z0-9]{4}(\s+[a-z0-9]{4}){3}$/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, "");
  }
  return trimmed;
}

function buildHtmlEmailBody(bodyText) {
  const escaped = String(bodyText || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return (
    '<div style="font-family: Sarabun, -apple-system, BlinkMacSystemFont, sans-serif; width: 100%; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-sizing: border-box;">' +
    '<div style="background: linear-gradient(135deg, #003d73, #0284c7); color: #ffffff; padding: 16px 20px; box-sizing: border-box;">' +
    '<h2 style="margin: 0; font-size: 16px; line-height: 1.4; word-break: break-word;">หอการค้าไทย (TCC IT Asset &amp; Helpdesk Service)</h2>' +
    '<p style="margin: 4px 0 0; font-size: 12px; line-height: 1.45; opacity: 0.92; word-break: break-word;">ระบบแจ้งเตือนอัตโนมัติ ฝ่ายเทคโนโลยีสารสนเทศ</p>' +
    "</div>" +
    '<div style="padding: 18px 20px; background: #ffffff; color: #1e293b; font-size: 14px; line-height: 1.65; white-space: pre-line; word-break: break-word; box-sizing: border-box;">' +
    escaped +
    "</div>" +
    '<div style="padding: 12px 20px; background: #f8fafc; color: #64748b; font-size: 11px; line-height: 1.45; border-top: 1px solid #e2e8f0; word-break: break-word; box-sizing: border-box;">' +
    "อีเมลฉบับนี้ส่งอัตโนมัติจากศูนย์บริการไอที หอการค้าไทย (itsupport@thaichamber.or.th)" +
    "</div></div>"
  );
}

async function inspectDomainMailProvider(domain = "thaichamber.or.th") {
  const info = {
    domain,
    mxRecords: [],
    provider: "unknown",
    recommendedSmtp: ""
  };
  try {
    const records = await dns.promises.resolveMx(domain);
    const sorted = (records || []).sort((a, b) => (a.priority || 0) - (b.priority || 0));
    info.mxRecords = sorted.map((r) => String(r.exchange || "").toLowerCase().replace(/\.$/, ""));
    const mxJoined = info.mxRecords.join(" ");
    if (mxJoined.includes("google.com") || mxJoined.includes("googlemail.com") || mxJoined.includes("aspmx.l.google.com")) {
      info.provider = "Google Workspace (Gmail)";
      info.recommendedSmtp = "smtp.gmail.com:465";
    } else if (mxJoined.includes("outlook.com") || mxJoined.includes("protection.outlook.com")) {
      info.provider = "Microsoft 365 / Exchange Online";
      info.recommendedSmtp = "smtp.office365.com:587";
    } else if (info.mxRecords.length > 0) {
      info.provider = `เซิร์ฟเวอร์อีเมลองค์กร (${info.mxRecords[0]})`;
      info.recommendedSmtp = `mail.${domain}:587 หรือ ${info.mxRecords[0]}:587`;
    }
  } catch (_) {}
  return info;
}

async function resolveSmtpEndpoints(smtpHost, smtpPort, userEmail, mxInfo) {
  const domain = String(userEmail || DEFAULT_SENDER_EMAIL).split("@")[1] || "thaichamber.or.th";
  const hostClean = String(smtpHost || "auto").trim().toLowerCase();
  const candidates = [];
  const seen = new Set();

  function addCandidate(host, port, secure) {
    if (!host) return;
    const key = `${host}:${port}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ host, port, secure });
  }

  // If user specified custom host:port in smtpHost (e.g. "mail.thaichamber.or.th:587")
  if (hostClean && hostClean !== "auto") {
    let parsedHost = hostClean;
    let parsedPort = Number(smtpPort) || 0;
    if (hostClean.includes(":")) {
      const parts = hostClean.split(":");
      parsedHost = parts[0].trim();
      parsedPort = Number(parts[1]) || parsedPort;
    }
    if (parsedHost === "smtp.gmail.com") {
      addCandidate("smtp.gmail.com", 465, true);
      addCandidate("smtp.gmail.com", 587, false);
    } else if (parsedHost.includes("office365") || parsedHost.includes("outlook")) {
      addCandidate(parsedHost, parsedPort || 587, false);
    } else {
      const p = parsedPort || 587;
      addCandidate(parsedHost, p, p === 465);
      if (!parsedPort) addCandidate(parsedHost, 465, true);
    }
  }

  // Add MX-detected endpoints so even if user selected the wrong dropdown, we can auto-fallback or diagnose
  const mxJoined = (mxInfo?.mxRecords || []).join(" ");
  if (mxJoined.includes("outlook.com") || mxJoined.includes("protection.outlook.com")) {
    addCandidate("smtp.office365.com", 587, false);
  } else if (mxJoined.includes("google.com") || mxJoined.includes("googlemail.com")) {
    addCandidate("smtp.gmail.com", 465, true);
    addCandidate("smtp.gmail.com", 587, false);
  } else if (mxInfo?.mxRecords?.length) {
    addCandidate(`mail.${domain}`, 587, false);
    addCandidate(`mail.${domain}`, 465, true);
    addCandidate(`smtp.${domain}`, 587, false);
    addCandidate(mxInfo.mxRecords[0], 587, false);
  }

  addCandidate("smtp.gmail.com", 465, true);
  addCandidate("smtp.office365.com", 587, false);
  return candidates;
}

function createSmtpSession(socket) {
  let buffer = "";
  let currentWaiter = null;

  function onData(chunk) {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\r\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line) continue;
      if (currentWaiter) {
        currentWaiter.lines.push(line);
        if (/^\d{3} /.test(line)) {
          const w = currentWaiter;
          currentWaiter = null;
          clearTimeout(w.timer);
          w.resolve({
            code: parseInt(line.slice(0, 3), 10),
            message: w.lines.join("\n")
          });
        }
      }
    }
  }

  function onError(err) {
    if (currentWaiter) {
      const w = currentWaiter;
      currentWaiter = null;
      clearTimeout(w.timer);
      w.reject(err);
    }
  }

  function attach(sock) {
    sock.on("data", onData);
    sock.on("error", onError);
    sock.on("close", () => onError(new Error("SMTP connection closed unexpectedly")));
  }

  attach(socket);

  function readResponse(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        currentWaiter = null;
        reject(new Error("SMTP response timeout"));
      }, timeoutMs);
      currentWaiter = { lines: [], resolve, reject, timer };
    });
  }

  async function sendCommand(sock, cmd, expectedCodes = [250]) {
    const waitPromise = readResponse();
    sock.write(cmd + "\r\n");
    const res = await waitPromise;
    if (!expectedCodes.includes(res.code)) {
      const err = new Error(`SMTP Error (${res.code}): ${res.message}`);
      err.smtpCode = res.code;
      err.smtpMessage = res.message;
      throw err;
    }
    return res;
  }

  return { readResponse, sendCommand, attach };
}

async function sendViaSingleSmtpEndpoint(endpoint, auth, mail) {
  const { host, port, secure } = endpoint;
  let socket = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Connection timeout to ${host}:${port}`)), 8500);
    const conn = secure
      ? tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
          clearTimeout(timer);
          resolve(conn);
        })
      : net.connect({ host, port }, () => {
          clearTimeout(timer);
          resolve(conn);
        });
    conn.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  const session = createSmtpSession(socket);
  try {
    const greeting = await session.readResponse();
    if (greeting.code !== 220) {
      throw new Error(`Invalid SMTP greeting (${greeting.code}): ${greeting.message}`);
    }

    await session.sendCommand(socket, "EHLO tcc-it-system.local", [250]);

    if (!secure) {
      await session.sendCommand(socket, "STARTTLS", [220]);
      socket.removeAllListeners("data");
      socket.removeAllListeners("error");
      socket.removeAllListeners("close");
      socket = await new Promise((resolve, reject) => {
        const tlsSock = tls.connect({ socket, servername: host, rejectUnauthorized: false }, () => resolve(tlsSock));
        tlsSock.once("error", reject);
      });
      session.attach(socket);
      await session.sendCommand(socket, "EHLO tcc-it-system.local", [250]);
    }

    const cleanPass = normalizeSmtpPassword(auth.pass);
    // Try AUTH PLAIN first, fallback to AUTH LOGIN if needed
    const plainToken = Buffer.from(`\u0000${auth.user}\u0000${cleanPass}`, "utf8").toString("base64");
    try {
      await session.sendCommand(socket, `AUTH PLAIN ${plainToken}`, [235]);
    } catch (plainErr) {
      if (plainErr.smtpCode === 504 || plainErr.smtpCode === 500 || plainErr.smtpCode === 502) {
        await session.sendCommand(socket, "AUTH LOGIN", [334]);
        await session.sendCommand(socket, Buffer.from(auth.user, "utf8").toString("base64"), [334]);
        await session.sendCommand(socket, Buffer.from(cleanPass, "utf8").toString("base64"), [235]);
      } else {
        throw plainErr;
      }
    }

    if (mail.checkOnly) {
      try {
        await session.sendCommand(socket, "QUIT", [221, 250]);
      } catch (_) {}
      socket.destroy();
      return { ok: true, host, port };
    }

    const envelopeFrom = mail.fromEmail || DEFAULT_SENDER_EMAIL;
    try {
      await session.sendCommand(socket, `MAIL FROM:<${envelopeFrom}>`, [250]);
    } catch (fromErr) {
      if (auth.user !== envelopeFrom) {
        await session.sendCommand(socket, `MAIL FROM:<${auth.user}>`, [250]);
      } else {
        throw fromErr;
      }
    }

    for (const rcpt of mail.recipients) {
      await session.sendCommand(socket, `RCPT TO:<${rcpt}>`, [250, 251]);
    }

    await session.sendCommand(socket, "DATA", [354]);

    const htmlContent = buildHtmlEmailBody(mail.body);
    const htmlBase64 = Buffer.from(htmlContent, "utf8")
      .toString("base64")
      .replace(/(.{76})/g, "$1\r\n");

    const fromHeader = `${encodeMimeWord(mail.senderName)} <${envelopeFrom}>`;
    const toHeader = mail.recipients.join(", ");
    const replyToHeader = mail.replyTo || envelopeFrom;
    const subjectHeader = encodeMimeWord(mail.subject);
    const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@thaichamber.or.th>`;

    const mimeMessage = [
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${msgId}`,
      `From: ${fromHeader}`,
      `To: ${toHeader}`,
      `Reply-To: ${replyToHeader}`,
      `Subject: ${subjectHeader}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      htmlBase64,
      "."
    ].join("\r\n");

    await session.sendCommand(socket, mimeMessage, [250]);
    try {
      await session.sendCommand(socket, "QUIT", [221, 250]);
    } catch (_) {}
    socket.destroy();
    return { ok: true, host, port };
  } catch (err) {
    try {
      socket.destroy();
    } catch (_) {}
    throw err;
  }
}

async function diagnoseAppPasswordOwner(pass, mxInfo) {
  const cleanPass = normalizeSmtpPassword(pass);
  if (!cleanPass) return null;
  // Only run quick diagnostic check on smtp.gmail.com if pass looks like a 16-char Google App Password
  if (!/^[a-z0-9]{16}$/i.test(cleanPass)) return null;

  const gmailEp = { host: "smtp.gmail.com", port: 465, secure: true };
  // Check if the user accidentally generated the App Password while logged into tatitop07@gmail.com
  try {
    const checkBlocked = await sendViaSingleSmtpEndpoint(
      gmailEp,
      { user: "tatitop07@gmail.com", pass: cleanPass },
      { checkOnly: true }
    );
    if (checkBlocked && checkBlocked.ok) {
      return {
        matchedAccount: "tatitop07@gmail.com",
        blocked: true
      };
    }
  } catch (_) {}

  // Check if the App Password belongs to tatiphon.hi@thaichamber.or.th
  try {
    const checkTatiphon = await sendViaSingleSmtpEndpoint(
      gmailEp,
      { user: "tatiphon.hi@thaichamber.or.th", pass: cleanPass },
      { checkOnly: true }
    );
    if (checkTatiphon && checkTatiphon.ok) {
      return {
        matchedAccount: "tatiphon.hi@thaichamber.or.th",
        blocked: false
      };
    }
  } catch (_) {}

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", sent: false, error: "Method Not Allowed (Use POST)" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const senderEmail = String(body.senderEmail || body.senderAlias || DEFAULT_SENDER_EMAIL)
    .trim()
    .toLowerCase();
  const smtpAuthUser = String(body.smtpAuthUser || body.smtpUser || process.env.SMTP_USER || senderEmail)
    .trim()
    .toLowerCase();
  const smtpPass = String(body.smtpPass || process.env.SMTP_PASS || "").trim();
  const smtpHost = String(body.smtpHost || process.env.SMTP_HOST || "auto").trim();
  const smtpPort = body.smtpPort || process.env.SMTP_PORT || "";

  if (isBlockedEmail(senderEmail) || isBlockedEmail(smtpAuthUser)) {
    return res.status(400).json({
      status: "error",
      sent: false,
      error: "ระบบบล็อกการใช้อีเมล tatitop07@gmail.com ในการส่งจริงและทดสอบ (กรุณาใช้ itsupport@thaichamber.or.th เท่านั้น)"
    });
  }

  const rawTo = Array.isArray(body.to || body.recipients)
    ? (body.to || body.recipients)
    : String(body.to || body.recipients || "").split(",");
  const recipients = Array.from(
    new Set(
      rawTo
        .map((r) => String(r || "").trim().toLowerCase())
        .filter((r) => r.includes("@") && !isBlockedEmail(r))
    )
  );

  const checkOnly = body.action === "check";
  if (!checkOnly && recipients.length === 0) {
    return res.status(200).json({
      status: "error",
      sent: false,
      error: "ไม่พบอีเมลผู้รับปลายทางที่ถูกต้อง (ระบบไม่อนุญาตให้ส่งหา tatitop07@gmail.com)"
    });
  }

  const domain = senderEmail.split("@")[1] || "thaichamber.or.th";
  const mxInfo = await inspectDomainMailProvider(domain);

  if (!smtpPass) {
    return res.status(200).json({
      status: "error",
      sent: false,
      needsSmtpPassword: true,
      senderEmail,
      mxInfo,
      error: `ยังไม่ได้ตั้งค่ารหัสผ่าน / App Password สำหรับ ${senderEmail} (ผู้ให้บริการอีเมลของ @${domain}: ${mxInfo.provider})`
    });
  }

  const endpoints = await resolveSmtpEndpoints(smtpHost, smtpPort, senderEmail, mxInfo);
  let lastError = null;
  const triedEndpoints = [];

  for (const ep of endpoints) {
    try {
      triedEndpoints.push(`${ep.host}:${ep.port}`);
      const result = await sendViaSingleSmtpEndpoint(
        ep,
        { user: smtpAuthUser, pass: smtpPass },
        {
          checkOnly,
          fromEmail: senderEmail,
          recipients,
          subject: body.subject || "[TCC IT Notification]",
          body: body.body || body.summary || "",
          senderName: body.senderName || "TCC IT Service & Asset System",
          replyTo: (!isBlockedEmail(body.replyTo) && body.replyTo) || senderEmail
        }
      );
      if (result.ok) {
        return res.status(200).json({
          status: "success",
          sent: !checkOnly,
          mailAuthorized: true,
          senderEmail,
          smtpAuthUser,
          mxInfo,
          method: `SMTP (${result.host}:${result.port})`,
          recipients,
          remainingQuota: null
        });
      }
    } catch (err) {
      lastError = err;
    }
  }

  // If authentication failed with 535, run smart diagnosis to tell the user the exact cause
  const rawErrMsg = lastError ? lastError.message : "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ SMTP ได้";
  let friendlyError = `SMTP (${senderEmail}) ส่งไม่สำเร็จ: ${rawErrMsg}`;

  if (rawErrMsg.includes("535") || rawErrMsg.toLowerCase().includes("badcredentials") || rawErrMsg.toLowerCase().includes("authentication")) {
    const ownerDiag = await diagnoseAppPasswordOwner(smtpPass, mxInfo);
    if (ownerDiag && ownerDiag.blocked) {
      friendlyError =
        `⛔ ตรวจพบว่ารหัส App Password ที่กรอกถูกสร้างมาจากบัญชี "${ownerDiag.matchedAccount}" (ไม่ใช่ของ ${senderEmail})! ` +
        `เนื่องจากระบบบล็อกการใช้ ${ownerDiag.matchedAccount} ถาวร จึงไม่อนุญาตให้ใช้รหัสของบัญชีดังกล่าว — ` +
        `กรุณาล็อกอินเข้าบัญชี ${senderEmail} โดยตรงเพื่อสร้างรหัส App Password ของ ${senderEmail} (ผู้ให้บริการโดเมน @${domain}: ${mxInfo.provider})`;
    } else if (ownerDiag && !ownerDiag.blocked && ownerDiag.matchedAccount) {
      try {
        const autoEp = { host: "smtp.gmail.com", port: 465, secure: true };
        const fallbackSend = await sendViaSingleSmtpEndpoint(
          autoEp,
          { user: ownerDiag.matchedAccount, pass: smtpPass },
          {
            checkOnly,
            fromEmail: senderEmail,
            recipients,
            subject: body.subject || "[TCC IT Notification]",
            body: body.body || body.summary || "",
            senderName: body.senderName || "TCC IT Service & Asset System",
            replyTo: (!isBlockedEmail(body.replyTo) && body.replyTo) || senderEmail
          }
        );
        if (fallbackSend && fallbackSend.ok) {
          return res.status(200).json({
            status: "success",
            sent: !checkOnly,
            mailAuthorized: true,
            senderEmail,
            smtpAuthUser: ownerDiag.matchedAccount,
            mxInfo,
            method: `SMTP (smtp.gmail.com:465 • Auth: ${ownerDiag.matchedAccount})`,
            recipients,
            remainingQuota: null
          });
        }
      } catch (_) {}
      friendlyError =
        `⚠️ ตรวจพบว่ารหัส App Password ที่กรอกเป็นของบัญชี "${ownerDiag.matchedAccount}" ไม่ใช่ของ "${senderEmail}" โดยตรง ` +
        `กรุณาระบุช่อง "บัญชีที่ใช้ยืนยันตัวตน SMTP" เป็น ${ownerDiag.matchedAccount} หรือสร้าง App Password ใหม่จากในบัญชี ${senderEmail} โดยตรง`;
    } else {
      const mxHint = mxInfo.mxRecords.length
        ? ` (ตรวจพบเซิร์ฟเวอร์อีเมลของ @${domain} คือ: ${mxInfo.provider} [${mxInfo.mxRecords.join(", ")}])`
        : "";
      friendlyError =
        `❌ รหัสผ่าน หรือ App Password ไม่ตรงกับบัญชี ${smtpAuthUser}${mxHint} — ` +
        `สาเหตุที่พบบ่อย: (1) เผลอสร้าง App Password ขณะเบราว์เซอร์ล็อกอินบัญชี Gmail อื่นอยู่ (ต้องล็อกอินเข้า ${senderEmail} ก่อนสร้าง App Password) ` +
        `หรือ (2) หาก @${domain} ใช้ Microsoft 365 / Mail Server องค์กร ให้ใช้รหัสผ่านของอีเมล ${senderEmail} และเลือกผู้ให้บริการ SMTP ให้ตรงกับโดเมน`;
    }
  }

  return res.status(200).json({
    status: "error",
    sent: false,
    mailAuthorized: false,
    senderEmail,
    smtpAuthUser,
    mxInfo,
    triedEndpoints,
    rawError: rawErrMsg,
    error: friendlyError
  });
};
