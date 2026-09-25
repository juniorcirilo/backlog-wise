import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Mail, Loader2 } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Schemas centralizados — qualquer regra de validação muda aqui.
const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, "O nome completo deve ter no mínimo 3 caracteres."),
    email: z.string().trim().email("Informe um e-mail válido."),
    password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

const LoginSignupForm = () => {
  const navigate = useNavigate();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();

  const [isActive, setIsActive] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [fullName, setFullName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleRegisterClick = () => setIsActive(true);
  const handleLoginClick = () => setIsActive(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setLoginLoading(true);
    const { error } = await signInWithEmail(parsed.data.email, parsed.data.password);
    setLoginLoading(false);
    if (error) {
      const msg = /email not confirmed/i.test(error)
        ? "Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada (e a pasta de spam)."
        : error;
      toast.error(msg);
      return;
    }
    navigate("/dashboard");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse({
      fullName,
      email: registerEmail,
      password: registerPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setRegisterLoading(true);
    const result = await signUpWithEmail(parsed.data.email, parsed.data.password, parsed.data.fullName);
    setRegisterLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    const { isFirstUser, requiresEmailConfirmation, requiresApproval } = result;

    if (isFirstUser) {
      if (requiresEmailConfirmation) {
        toast.success("Conta de administrador criada!", {
          description: "Confirme seu e-mail para entrar. Verifique sua caixa de entrada (e a pasta de spam).",
          duration: 8000,
        });
      } else {
        toast.success("Conta de administrador criada com sucesso!", {
          description: "Você já pode fazer login.",
          duration: 6000,
        });
      }
    } else if (requiresApproval) {
      toast.success("Conta criada com sucesso!", {
        description: requiresEmailConfirmation
          ? "Confirme seu e-mail e aguarde a aprovação de um administrador."
          : "Sua conta está aguardando aprovação de um administrador.",
        duration: 8000,
      });
    } else {
      toast.success("Conta criada com sucesso!", {
        description: requiresEmailConfirmation
          ? "Confirme seu e-mail para fazer login."
          : "Você já pode fazer login.",
        duration: 6000,
      });
    }

    setIsActive(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(error);
      setGoogleLoading(false);
    }
  };

  const GoogleIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );

  return (
    <>
      <style>{`
        .lsf-container {
          position: relative;
          width: 850px;
          max-width: 100%;
          height: 580px;
          background: hsl(var(--bg-elevated));
          border-radius: 30px;
          box-shadow: 0 0 30px rgba(0, 0, 0, .2);
          overflow: hidden;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .lsf-container h1 { font-size: 32px; margin: -10px 0; color: hsl(var(--text-primary)); font-weight: 700; }
        .lsf-container p { font-size: 14.5px; margin: 12px 0; color: hsl(var(--text-primary)); }

        .lsf-form-box {
          position: absolute;
          right: 0;
          width: 50%;
          height: 100%;
          background: hsl(var(--bg-elevated));
          display: flex;
          align-items: center;
          color: hsl(var(--text-primary));
          text-align: center;
          padding: 40px;
          z-index: 1;
          transition: .6s ease-in-out 1.2s, visibility 0s 1s;
        }
        .lsf-container.active .lsf-form-box.login { right: 50%; }
        .lsf-form-box.register { visibility: hidden; right: 0; }
        .lsf-container.active .lsf-form-box.register { visibility: visible; right: 50%; }

        .lsf-form-container { width: 100%; }

        .lsf-input-box { position: relative; margin: 20px 0; }
        .lsf-input-box input {
          width: 100%;
          padding: 13px 50px 13px 20px;
          background: hsl(var(--bg-surface-2));
          border-radius: 8px;
          border: none;
          outline: none;
          font-size: 15px;
          color: hsl(var(--text-primary));
          font-weight: 500;
        }
        .lsf-input-box input::placeholder { color: hsl(var(--text-tertiary)); font-weight: 400; }
        .lsf-input-box .lsf-icon {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          color: hsl(var(--text-tertiary));
        }

        .lsf-btn {
          width: 100%;
          height: 48px;
          background: hsl(var(--bg-dark));
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, .1);
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: hsl(var(--text-on-dark));
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: filter .2s ease;
        }
        .lsf-btn:hover:not(:disabled) { filter: brightness(1.08); }
        .lsf-btn:disabled { opacity: .6; cursor: not-allowed; }

        .lsf-social-icons { display: flex; justify-content: center; }
        .lsf-social-icons button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          border: 2px solid hsl(var(--border-default));
          background: hsl(var(--bg-elevated));
          border-radius: 8px;
          color: hsl(var(--text-primary));
          margin: 0 8px;
          cursor: pointer;
          transition: border-color .2s ease;
        }
        .lsf-social-icons button:hover:not(:disabled) { border-color: hsl(var(--bg-dark)); }
        .lsf-social-icons button:disabled { opacity: .6; cursor: not-allowed; }

        .lsf-toggle-box { position: absolute; width: 100%; height: 100%; }
        .lsf-toggle-box::before {
          content: '';
          position: absolute;
          left: -250%;
          width: 300%;
          height: 100%;
          background: hsl(var(--bg-dark));
          border-radius: 150px;
          z-index: 2;
          transition: 1.8s ease-in-out;
        }
        .lsf-container.active .lsf-toggle-box::before { left: 50%; }

        .lsf-toggle-panel {
          position: absolute;
          width: 50%;
          height: 100%;
          color: hsl(var(--text-on-dark));
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 2;
          transition: .6s ease-in-out;
          padding: 0 30px;
          text-align: center;
        }
        .lsf-toggle-panel h1 { color: hsl(var(--text-on-dark)); }
        .lsf-toggle-panel p { color: hsl(var(--text-on-dark-muted)); margin-bottom: 20px; }

        .lsf-toggle-panel.toggle-left { left: 0; transition-delay: 1.2s; }
        .lsf-container.active .lsf-toggle-panel.toggle-left { left: -50%; transition-delay: .6s; }

        .lsf-toggle-panel.toggle-right { right: -50%; transition-delay: .6s; }
        .lsf-container.active .lsf-toggle-panel.toggle-right { right: 0; transition-delay: 1.2s; }

        .lsf-toggle-panel .lsf-btn {
          width: 160px;
          height: 46px;
          background: transparent;
          border: 2px solid hsl(var(--text-on-dark));
          box-shadow: none;
        }

        @media screen and (max-width: 850px) {
          .lsf-container { width: 100%; height: calc(100vh - 40px); max-height: 720px; }
          .lsf-form-box { bottom: 0; width: 100%; height: 70%; }
          .lsf-container.active .lsf-form-box.login { right: 0; bottom: 30%; }
          .lsf-container.active .lsf-form-box.register { right: 0; bottom: 30%; }
          .lsf-toggle-box::before { left: 0; top: -270%; width: 100%; height: 300%; border-radius: 20vw; }
          .lsf-container.active .lsf-toggle-box::before { left: 0; top: 70%; }
          .lsf-toggle-panel { width: 100%; height: 30%; }
          .lsf-toggle-panel.toggle-left { top: 0; left: 0; }
          .lsf-container.active .lsf-toggle-panel.toggle-left { left: 0; top: -30%; }
          .lsf-toggle-panel.toggle-right { right: 0; bottom: -30%; top: auto; }
          .lsf-container.active .lsf-toggle-panel.toggle-right { bottom: 0; right: 0; }
        }
        @media screen and (max-width: 400px) {
          .lsf-form-box { padding: 20px; }
          .lsf-toggle-panel h1 { font-size: 26px; }
        }
      `}</style>

      <div className={`lsf-container ${isActive ? "active" : ""}`}>
        {/* Login */}
        <div className="lsf-form-box login">
          <form className="lsf-form-container" onSubmit={handleLogin}>
            <h1>Login</h1>
            <div className="lsf-input-box">
              <input
                type="email"
                placeholder="Email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
              <Mail className="lsf-icon" size={20} />
            </div>
            <div className="lsf-input-box">
              <input
                type="password"
                placeholder="Senha"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
              <Lock className="lsf-icon" size={20} />
            </div>
            <button type="submit" className="lsf-btn" disabled={loginLoading}>
              {loginLoading && <Loader2 className="animate-spin" size={18} />}
              Entrar
            </button>
            <p>ou entre com</p>
            <div className="lsf-social-icons">
              <button type="button" onClick={handleGoogle} disabled={googleLoading} aria-label="Entrar com Google">
                {googleLoading ? <Loader2 className="animate-spin" size={20} /> : <GoogleIcon />}
              </button>
            </div>
          </form>
        </div>

        {/* Register */}
        <div className="lsf-form-box register">
          <form className="lsf-form-container" onSubmit={handleRegister}>
            <h1>Criar conta</h1>
            <div className="lsf-input-box">
              <input
                type="text"
                placeholder="Nome completo"
                required
                minLength={3}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <User className="lsf-icon" size={20} />
            </div>
            <div className="lsf-input-box">
              <input
                type="email"
                placeholder="Email"
                required
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
              />
              <Mail className="lsf-icon" size={20} />
            </div>
            <div className="lsf-input-box">
              <input
                type="password"
                placeholder="Senha (mín. 6)"
                required
                minLength={6}
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
              />
              <Lock className="lsf-icon" size={20} />
            </div>
            <div className="lsf-input-box">
              <input
                type="password"
                placeholder="Confirme a senha"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <Lock className="lsf-icon" size={20} />
            </div>
            <button type="submit" className="lsf-btn" disabled={registerLoading}>
              {registerLoading && <Loader2 className="animate-spin" size={18} />}
              Cadastrar
            </button>
            <p>ou cadastre-se com</p>
            <div className="lsf-social-icons">
              <button type="button" onClick={handleGoogle} disabled={googleLoading} aria-label="Cadastrar com Google">
                {googleLoading ? <Loader2 className="animate-spin" size={20} /> : <GoogleIcon />}
              </button>
            </div>
          </form>
        </div>

        {/* Toggle */}
        <div className="lsf-toggle-box">
          <div className="lsf-toggle-panel toggle-left">
            <h1>Olá, bem-vindo!</h1>
            <p>Ainda não tem conta?</p>
            <button type="button" className="lsf-btn" onClick={handleRegisterClick}>
              Cadastrar
            </button>
          </div>
          <div className="lsf-toggle-panel toggle-right">
            <h1>Bem-vindo de volta!</h1>
            <p>Já tem uma conta?</p>
            <button type="button" className="lsf-btn" onClick={handleLoginClick}>
              Entrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginSignupForm;
