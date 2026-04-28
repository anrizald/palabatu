import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
    },
});

export const sendVerificationEmail = async (email: string, token: string) => {
    const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Verify your Palabatu account',
        html: `
            <h2>Welcome to Palabatu! 🧗</h2>
            <p>Click the link below to verify your email:</p>
            <a href="${verifyUrl}">${verifyUrl}</a>
            <p>Link expires in 24 hours.</p>
        `,
    });
};