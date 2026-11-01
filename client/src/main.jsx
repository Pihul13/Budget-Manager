import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  useAuth,
} from "@clerk/react";
import App from "./App.jsx";
import { setTokenProvider } from "./lib/api.js";
import "./styles.css";
import "./auth.css";

function SignInScreen() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">₹</div>
        <span className="eyebrow">Personal finance, made personal</span>
        <h1>Your money. Your space.</h1>
        <p>
          Keep your accounts, budgets, goals, and transactions in a private
          workspace that belongs to you.
        </p>
        <div className="auth-actions">
          <SignUpButton mode="modal">
            <button className="btn primary">Create your account</button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className="btn">Sign in</button>
          </SignInButton>
        </div>
      </section>
    </main>
  );
}

function AuthenticationGate() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const [apiReady, setApiReady] = React.useState(false);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setTokenProvider(null);
      setApiReady(false);
      return;
    }
    setTokenProvider(getToken, userId);
    setApiReady(true);
    return () => setTokenProvider(null);
  }, [getToken, isLoaded, isSignedIn, userId]);

  if (!isLoaded || (isSignedIn && !apiReady)) {
    return <main className="auth-page">Loading your private workspace…</main>;
  }
  return isSignedIn ? <App /> : <SignInScreen />;
}

function MissingConfiguration() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Authentication is not configured</h1>
        <p>
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in the client environment
          and rebuild the app.
        </p>
      </section>
    </main>
  );
}

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    {publishableKey ? (
      <ClerkProvider publishableKey={publishableKey}>
        <BrowserRouter>
          <AuthenticationGate />
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <MissingConfiguration />
    )}
  </React.StrictMode>,
);
