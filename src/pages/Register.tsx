import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      await register(name, email, password);
      navigate("/app");
    } catch (err) {
      setError("Failed to register. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-neutral-50 animate-fade-in">
      <div className="sm:mx-auto sm:w-full sm:max-w-md animate-slide-in">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-neutral-900">
          Create your account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md animate-slide-in" style={{ animationDelay: '0.1s' }}>
        <div className="card p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field w-full"
              />
            </div>

            {error && <div className="text-red-500 text-sm animate-fade-in bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

            <div>
              <button
                type="submit"
                className="btn-primary w-full justify-center"
              >
                Register
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Already a member?{" "}
            <Link to="/login" className="font-semibold leading-6 text-primary-600 hover:text-primary-500 transition-colors duration-200">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
