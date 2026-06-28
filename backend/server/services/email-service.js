import nodemailer from 'nodemailer'
import '../load-env.js'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

/**
 * Envía un correo electrónico maquetado con diseño profesional de bienvenida a la plataforma.
 * @param {string} userEmail Dirección del usuario
 * @param {string} userName Nombre visible del usuario
 */
export async function sendWelcomeEmail(userEmail, userName) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"MyBrAIn" <tu_correo@gmail.com>',
    to: userEmail,
    subject: '¡Te damos la bienvenida a MyBrAIn! 🧠🚀',
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
            color: #1f2937;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 40px auto;
            background: rgba(255, 255, 255, 0.85);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(0, 0, 0, 0.05);
          }
          .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            padding: 40px;
            text-align: center;
            color: #ffffff;
          }
          .logo-text {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
            margin: 0;
          }
          .content {
            padding: 40px;
            line-height: 1.6;
          }
          h1 {
            font-size: 22px;
            font-weight: 700;
            color: #111827;
            margin-top: 0;
            margin-bottom: 20px;
          }
          p {
            font-size: 15px;
            color: #4b5563;
            margin-bottom: 24px;
          }
          .btn-primary {
            display: inline-block;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 30px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
            margin-top: 10px;
            margin-bottom: 20px;
          }
          .footer {
            background-color: #f9fafb;
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            border-top: 1px solid #f3f4f6;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h2 class="logo-text">🧠 MyBrAIn</h2>
          </div>
          <div class="content">
            <h1>¡Hola, ${userName}! 👋</h1>
            <p>Nos alegra enormemente darte la bienvenida a <strong>MyBrAIn</strong>, tu centro de control personal impulsado por Inteligencia Artificial y Open Banking.</p>
            <p>A partir de ahora podrás sincronizar tus cuentas de banco de manera segura mediante Tink, automatizar tu control de ingresos y gastos, escanear tus tickets de compra y planificar tus menús saludables con la ayuda de nuestro asistente inteligente.</p>
            <div style="text-align: center;">
              <a href="http://localhost:5275/" class="btn-primary">Entrar a MyBrAIn</a>
            </div>
            <p>Si tienes alguna pregunta o sugerencia, no dudes en responder directamente a este correo.</p>
            <p>¡Hagamos tu vida financiera e intelectual más fácil y productiva!</p>
            <p>Un cordial saludo,<br><strong>El equipo de MyBrAIn</strong></p>
          </div>
          <div class="footer">
            &copy; 2026 MyBrAIn. Todos los derechos reservados.<br>
            Este correo es informativo y se envió debido a tu registro en nuestra plataforma.
          </div>
        </div>
      </body>
      </html>
    `,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log(`[Email] Correo de bienvenida enviado con éxito a ${userEmail}. ID: ${info.messageId}`)
    return info
  } catch (error) {
    console.error(`[Email] Error al enviar correo de bienvenida a ${userEmail}:`, error)
    // No lanzamos error para evitar romper la llamada HTTP si el SMTP falla temporalmente
    return null
  }
}
