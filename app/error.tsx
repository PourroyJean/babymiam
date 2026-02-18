"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Oups, une erreur est survenue</h1>
        <p>La page n&apos;a pas pu se charger correctement.</p>
        <button type="button" onClick={reset}>
          Réessayer
        </button>

        {process.env.NODE_ENV === "development" ? (
          <pre className="error-text">{error.message}</pre>
        ) : null}
      </section>
    </main>
  );
}
