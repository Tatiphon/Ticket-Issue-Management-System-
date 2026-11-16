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

function buildHtmlEmailBody(bodyText) {
  const escaped = String(bodyText || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return (
    '<div style="font-family: Sarabun, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">' +
    '<div style="background: linear-gradient(135deg, #003d73, #0284c7); color: #ffffff; padding: 18px 24px;">' +
    '<h2 style="margin: 0; font-size: 18px;">หอการค้าไทย (TCC IT Asset &amp; Helpdesk Service)</h2>' +
    '<p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">ระบบแจ้งเตือนอัตโนมัติ ฝ่ายเทคโนโลยีสารสนเทศ (itsupport@thaichamber.or.th)</p>' +
    "</div>" +
    '<div style="padding: 20px 24px; background: #ffffff; color: #1e293b; font-size: 14px; line-height: 1.65; white-space: pre-line;">' +
    escaped +
    "</div>" +
    '<div style="padding: 12px 24px; background: #f8fafc; color: #64748b; font-size: 11px; border-top: 1px solid #e2e8f0;">' +
    "อีเมลฉบับนี้ส่งอัตโนมัติจากศูนย์บริการไอที หอการค้าไทย (itsupport@thaichamber.or.th)" +
    "</div></div>"
  );
}

async function resolveSmtpEndpoints(smtpHost, smtpPort, userEmail) {
  const hostClean = String(smtpHost || "auto").trim().toLowerCase();
  if (hostClean && hostClean !== "auto") {
    const port = Number(smtpPort) || (hostClean.includes("office365") || hostClean.includes("outlook") ? 587 : 465);
    return [{ host: hostClean, port, secure: port === 465 }];
  }

  const domain = String(userEmail || DEFAULT_SENDER_EMAIL).split("@")[1] || "thaichamber.or.th";
  const candidates = [];
  try {
    const mxRecords = await dns.promises.resolveMx(domain);
    const mxStr = mxRecords.map((r) => String(r.exchange || "").toLowerCase()).join(" ");
    if (mxStr.includes("outlook.com") || mxStr.includes("protection.outlook.com")) {
      candidates.push({ host: "smtp.office365.com", port: 587, secure: false });
    } else if (mxStr.includes("google.com") || mxStr.includes("googlemail.com")) {
      candidates.push({ host: "smtp.gmail.com", port: 465, secure: true });
      candidates.push({ host: "smtp.gmail.com", port: 587, secure: false });
    }
  } catch (_) {}

  candidates.push({ host: "smtp.gmail.com", port: 465, secure: true });
  candidates.push({ host: "smtp.office365.com", port: 587, secure: false });
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

  function readResponse(timeoutMs = 12000) {
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
      throw new Error(`SMTP Error (${res.code}): ${res.message}`);
    }
    return res;
  }

  return { readResponse, sendCommand, attach };
}

async function sendViaSingleSmtpEndpoint(endpoint, auth, mail) {
  const { host, port, secure } = endpoint;
  let socket = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Connection timeout to ${host}:${port}`)), 10000);
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

    await session.sendCommand(socket, "AUTH LOGIN", [334]);
    await session.sendCommand(socket, Buffer.from(auth.user, "utf8").toString("base64"), [334]);
    await session.sendCommand(
      socket,
      Buffer.from(auth.pass.replace(/\s+/g, ""), "utf8").toString("base64"),
      [235]
    );

    if (mail.checkOnly) {
      try {
        await session.sendCommand(socket, "QUIT", [221, 250]);
      } catch (_) {}
      socket.destroy();
      return { ok: true, host, port };
    }

    await session.sendCommand(socket, `MAIL FROM:<${auth.user}>`, [250]);
    for (const rcpt of mail.recipients) {
      await session.sendCommand(socket, `RCPT TO:<${rcpt}>`, [250, 251]);
    }

    await session.sendCommand(socket, "DATA", [354]);

    const htmlContent = buildHtmlEmailBody(mail.body);
    const htmlBase64 = Buffer.from(htmlContent, "utf8")
      .toString("base64")
      .replace(/(.{76})/g, "$1\r\n");

    const fromHeader = `${encodeMimeWord(mail.senderName)} <${auth.user}>`;
    const toHeader = mail.recipients.join(", ");
    const replyToHeader = mail.replyTo || auth.user;
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
  const smtpUser = String(body.smtpUser || body.senderEmail || body.senderAlias || process.env.SMTP_USER || DEFAULT_SENDER_EMAIL)
    .trim()
    .toLowerCase();
  const smtpPass = String(body.smtpPass || process.env.SMTP_PASS || "").trim();
  const smtpHost = String(body.smtpHost || process.env.SMTP_HOST || "auto").trim();
  const smtpPort = body.smtpPort || process.env.SMTP_PORT || "";

  if (isBlockedEmail(smtpUser)) {
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

  if (!smtpPass) {
    return res.status(200).json({
      status: "error",
      sent: false,
      needsSmtpPassword: true,
      senderEmail: smtpUser,
      error: `ยังไม่ได้ตั้งค่ารหัสผ่าน / App Password สำหรับ ${smtpUser} (กรุณากรอกในช่องรหัสผ่าน SMTP สำหรับส่งอีเมล หรือตั้งค่า SMTP_PASS บน Server)`
    });
  }

  const endpoints = await resolveSmtpEndpoints(smtpHost, smtpPort, smtpUser);
  let lastError = null;

  for (const ep of endpoints) {
    try {
      const result = await sendViaSingleSmtpEndpoint(
        ep,
        { user: smtpUser, pass: smtpPass },
        {
          checkOnly,
          recipients,
          subject: body.subject || "[TCC IT Notification]",
          body: body.body || body.summary || "",
          senderName: body.senderName || "TCC IT Service & Asset System",
          replyTo: (!isBlockedEmail(body.replyTo) && body.replyTo) || smtpUser
        }
      );
      if (result.ok) {
        return res.status(200).json({
          status: "success",
          sent: !checkOnly,
          mailAuthorized: true,
          senderEmail: smtpUser,
          smtpEndpoint: `${result.host}:${result.port}`,
          sentTo: recipients,
          message: checkOnly
            ? `เชื่อมต่อเซิร์ฟเวอร์ SMTP (${result.host}:${result.port}) ของ ${smtpUser} สำเร็จ`
            : `ส่งอีเมลจาก ${smtpUser} สำเร็จ`
        });
      }
    } catch (err) {
      lastError = err;
    }
  }

  return res.status(200).json({
    status: "error",
    sent: false,
    senderEmail: smtpUser,
    error: `SMTP (${smtpUser}) ส่งไม่สำเร็จ: ${lastError ? lastError.message : "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์อีเมลได้"}`
  });
};
