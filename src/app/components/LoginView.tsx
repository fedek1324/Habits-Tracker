"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import axios from "axios";
import { loginAction } from "@/src/app/actions/auth";

const SCOPES = "openid";

export default function LoginView() {
  const router = useRouter();

  const login = useGoogleLogin({
    flow: "auth-code",
    scope: SCOPES,
    onSuccess: async (codeResponse) => {
      try {
        const { data } = await axios.post("/api/auth/google", {
          code: codeResponse.code,
        });
        const { userId } = data;
        if (userId) {
          await loginAction(userId);
          router.refresh();
        }
      } catch (err) {
        console.error("Login failed:", err);
      }
    },
    onError: (err) => console.error("Google login failed:", err),
  });

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full mx-4 text-center">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Habit Tracker</h1>
        <p className="text-gray-500 text-sm mb-8">
          Connect your Google account to sync habits across devices.
        </p>
        <button
          onClick={() => login()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.05 7.07l4.31 3.02C7.25 7.69 9.39 5.38 12 5.38z"
            />
          </svg>
          Connect with Google
        </button>
      </div>
    </div>
  );
}
