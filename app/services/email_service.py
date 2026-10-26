import smtplib
import ssl
from html import escape
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from ..i18n import t
from ..security import check_smtp_target, decrypt_secret, is_loopback_host, ValidationError

SMTP_TIMEOUT_SECONDS = 15


class DeliveryUncertain(Exception):
    """Conexiunea s-a întrerupt când mesajul putea fi deja acceptat de SMTP."""

# Singurii provideri acceptați. Serverul alege hostul, nu utilizatorul: nimeni nu poate
# face aplicația să se conecteze unde vrea el.
SMTP_SELECTIONS = {
    'gmail': ('smtp.gmail.com', 587),
    'yahoo': ('smtp.mail.yahoo.com', 587),
}

# Grupurile vechi (create înainte de alegerea explicită a providerului) nu au host salvat;
# pentru ele ghicim după domeniul adresei.
SMTP_PROVIDERS = {
    'gmail.com': ('smtp.gmail.com', 587),
    'googlemail.com': ('smtp.gmail.com', 587),
    'yahoo.com': ('smtp.mail.yahoo.com', 587),
    'yahoo.ro': ('smtp.mail.yahoo.com', 587),
}


def _detect_smtp(email, group):
    """Return (host, port, use_ssl) from group override or auto-detect."""
    if group.smtp_host and group.smtp_port:
        port = group.smtp_port
        use_ssl = port == 465
        return group.smtp_host, port, use_ssl

    domain = email.rsplit('@', 1)[-1].lower()
    if domain in SMTP_PROVIDERS:
        host, port = SMTP_PROVIDERS[domain]
        use_ssl = port == 465
        return host, port, use_ssl

    return None, None, False


class EmailService:
    @staticmethod
    def send_assignment(giver, receiver, group) -> bool:
        # Tot ce vine de la utilizatori trece prin escape: altfel un participant
        # ar putea pune linkuri/imagini în emailul trimis de pe contul organizatorului.
        group_name = escape(group.name)
        giver_name = escape(giver.name)
        receiver_name = escape(receiver.name)
        receiver_email = escape(receiver.email)
        # Fiecare primește emailul în limba în care s-a înscris.
        lang = giver.language or group.language
        wishlist = escape(receiver.wishlist) if receiver.wishlist else t('mail.no_wishlist', lang)
        budget_html = f"""
              <div style="background:#EBF5FB;border-radius:12px;padding:16px;text-align:center;">
                <p style="color:#2980B9;margin:0;font-size:14px;">&#128176; <strong>{t('mail.budget', lang)}</strong> {group.min_budget_ron:.0f} RON</p>
              </div>""" if group.min_budget_ron else ""
        # Fiecare gradient are o culoare simplă înainte: Yahoo ignoră gradientele,
        # iar fără ea textul alb ar rămâne pe fundal alb.
        html = f"""
        <!DOCTYPE html>
        <html lang="{lang or 'en'}">
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#1a472a;font-family:Arial,sans-serif;">
          <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
            <div style="background-color:#C0392B;background-image:linear-gradient(135deg,#C0392B,#922B21);padding:40px;text-align:center;">
              <div style="font-size:64px;">&#127877;&#127995;</div>
              <h1 style="color:#fff;margin:16px 0 8px;font-size:28px;font-weight:bold;">Secret Santa</h1>
              <p style="color:#FADBD8;margin:0;font-size:16px;">{group_name}</p>
            </div>
            <div style="padding:40px;">
              <h2 style="color:#2C3E50;margin:0 0 8px;">{t('mail.hello', lang, name=giver_name)}</h2>
              <p style="color:#7F8C8D;margin:0 0 24px;font-size:15px;">{t('mail.intro', lang)}</p>
              <div style="background-color:#27AE60;background-image:linear-gradient(135deg,#27AE60,#1E8449);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
                <p style="color:#E8F8EF;margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:2px;">{t('mail.you_are_santa', lang)}</p>
                <h2 style="color:#fff;margin:0;font-size:32px;font-weight:bold;">&#127873; {receiver_name}</h2>
                <p style="color:#E8F8EF;margin:8px 0 0;font-size:14px;">{receiver_email}</p>
              </div>
              <div style="background:#FFF8F0;border-radius:12px;padding:24px;margin-bottom:24px;border-left:4px solid #F39C12;">
                <h3 style="color:#2C3E50;margin:0 0 12px;font-size:16px;">&#128221; {t('mail.wishlist', lang)}</h3>
                <p style="color:#5D6D7E;margin:0;line-height:1.6;white-space:pre-wrap;">{wishlist}</p>
              </div>
              {budget_html}
            </div>
            <div style="background:#F2F3F4;padding:20px;text-align:center;">
              <p style="color:#95A5A6;margin:0;font-size:13px;">&#129323; {t('mail.keep_secret', lang)} &#127877;&#127995;</p>
            </div>
          </div>
        </body>
        </html>
        """

        return _send(group, giver.email, t('mail.assignment_subject', lang, group=group.name), html)

    @staticmethod
    def send_admin_link(group, admin_url) -> bool:
        group_name = escape(group.name)
        admin_url = escape(admin_url, quote=True)
        lang = group.language
        html = f"""
        <!DOCTYPE html>
        <html lang="{lang or 'en'}">
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#FFF8F0;font-family:Arial,sans-serif;">
          <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.1);">
            <div style="background-color:#C0392B;background-image:linear-gradient(135deg,#C0392B,#922B21);padding:32px;text-align:center;">
              <div style="font-size:48px;">&#127877;&#127995;</div>
              <h1 style="color:#fff;margin:12px 0 4px;font-size:24px;">{t('mail.admin_title', lang)}</h1>
              <p style="color:#FADBD8;margin:0;font-size:16px;">{group_name}</p>
            </div>
            <div style="padding:32px;">
              <p style="color:#2C3E50;font-size:15px;line-height:1.6;margin:0 0 20px;">
                {t('mail.admin_intro', lang)}
              </p>
              <p style="text-align:center;margin:0 0 24px;">
                <a href="{admin_url}" style="display:inline-block;background:#27AE60;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:50px;">{t('mail.admin_button', lang)}</a>
              </p>
              <div style="background:#FFF3CD;border-radius:12px;padding:16px;color:#856404;font-size:14px;line-height:1.5;">
                &#128274; {t('mail.admin_warning', lang)}<br>
                &#8987; {t('mail.admin_expiry', lang)}
              </div>
            </div>
          </div>
        </body>
        </html>
        """
        try:
            return _send(group, group.smtp_email, t('mail.admin_subject', lang, group=group.name), html)
        except DeliveryUncertain:
            # Grupul este deja creat. O confirmare SMTP pierdută nu trebuie să dea 500.
            return False


def _send(group, to_email, subject, html) -> bool:
    if not group.smtp_email or not group.smtp_password:
        return False
    password = decrypt_secret(group.smtp_password)
    if password is None:
        print(f"Parola SMTP pentru grupul {group.id} nu poate fi decriptata")
        return False

    host, port, use_ssl = _detect_smtp(group.smtp_email, group)
    if not host:
        print(f"Unknown SMTP provider for {group.smtp_email}")
        return False
    if group.smtp_host and (host, port) not in SMTP_SELECTIONS.values():
        try:
            # Grupuri vechi, create cu „SMTP custom”: verificăm din nou la trimitere.
            check_smtp_target(host, port)
        except ValidationError as e:
            print(f"SMTP refuzat pentru {host}:{port}: {e}")
            return False

    # Certificat verificat, ca parola să nu poată fi interceptată. Excepție: servere
    # locale din grupurile vechi „SMTP custom”, cu certificat propriu.
    context = ssl.create_default_context()
    if is_loopback_host(host):
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = group.smtp_email
    msg['To'] = to_email
    msg.attach(MIMEText(html, 'html', 'utf-8'))

    submission_started = False
    accepted = False
    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=SMTP_TIMEOUT_SECONDS, context=context) as server:
                server.login(getattr(group, 'smtp_username', None) or group.smtp_email, password)
                submission_started = True
                server.sendmail(group.smtp_email, to_email, msg.as_string())
                accepted = True
        else:
            with smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT_SECONDS) as server:
                server.ehlo()
                server.starttls(context=context)
                server.login(getattr(group, 'smtp_username', None) or group.smtp_email, password)
                submission_started = True
                server.sendmail(group.smtp_email, to_email, msg.as_string())
                accepted = True
        return True
    except Exception as e:
        if accepted:
            # O eroare la QUIT nu anulează confirmarea SMTP pentru mesaj.
            return True
        if submission_started and not isinstance(e, (smtplib.SMTPResponseException, smtplib.SMTPRecipientsRefused)):
            raise DeliveryUncertain() from e
        print(f"Email delivery failed ({type(e).__name__}) for group {group.id}")
        return False
