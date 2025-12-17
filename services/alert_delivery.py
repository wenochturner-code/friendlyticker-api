# services/alert_delivery.py

import os
import smtplib
from email.message import EmailMessage


def send_email(to: str, subject: str, body: str) -> None:
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    from_addr = os.getenv("SMTP_FROM", username)

    if not host or not username or not password or not from_addr:
        raise RuntimeError("Missing SMTP configuration env vars.")

    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body or "")

    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(username, password)
        server.send_message(msg)
