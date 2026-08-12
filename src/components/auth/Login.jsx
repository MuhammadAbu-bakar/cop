import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { signIn } from "../../api/auth";

// Import background image
import bgImage from "../../assets/images/bg-img.jpg";

const Login = () => {
  const [email, setEmail] = useState("admin@compliance.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { user, setUser, setProfile } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const { data, error } = await signIn(email, password);

      if (error) throw error;

      if (data?.user) {
        // The profile will be auto-created by the signIn function
        // Just navigate to dashboard
        navigate("/dashboard");
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err.message || "Invalid email or password. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        backgroundBlendMode: "overlay",
      }}
    >
      <div
        className="max-w-md w-full p-8 rounded-2xl relative overflow-hidden"
        style={{ minHeight: "500px" }}
      >
        {/* Glassmorphism Background */}
        <div className="absolute inset-0 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20"></div>

        {/* Animated Border - Top */}
        <div
          className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#8cc63e] via-[#e40076] to-[#8cc63e] animate-border-slide"
          style={{ zIndex: 2 }}
        ></div>

        {/* Animated Border - Right */}
        <div
          className="absolute top-0 right-0 w-[3px] h-[calc(100%-0px)] bg-gradient-to-b from-[#8cc63e] via-[#e40076] to-[#8cc63e] animate-border-slide-right"
          style={{ zIndex: 2 }}
        ></div>

        {/* Animated Border - Bottom */}
        <div
          className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#8cc63e] via-[#e40076] to-[#8cc63e] animate-border-slide-bottom"
          style={{ zIndex: 2 }}
        ></div>

        {/* Animated Border - Left */}
        <div
          className="absolute top-0 left-0 w-[3px] h-[calc(100%-0px)] bg-gradient-to-b from-[#8cc63e] via-[#e40076] to-[#8cc63e] animate-border-slide-left"
          style={{ zIndex: 2 }}
        ></div>

        {/* Content */}
        <div
          className="relative z-10 flex flex-col"
          style={{ minHeight: "440px" }}
        >
          {/* Logo/Brand */}
          <div className="text-center">
            <div className="flex justify-center">
              <div
                className="h-20 w-20 rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #8cc63e, #6ab04c)",
                }}
              >
                <svg
                  className="h-12 w-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="mt-6 text-center text-2xl font-bold text-white drop-shadow-lg">
              Compliance Orchestration Platform
            </h2>
            <p className="mt-2 text-center text-sm text-white/80 drop-shadow-md">
              Sign in to your account to continue
            </p>
          </div>

          {/* Message Display */}
          {message.text && (
            <div
              className={`p-3 rounded-lg mt-4 ${
                message.type === "error"
                  ? "bg-red-500/20 text-red-200 border border-red-500/30 backdrop-blur-sm"
                  : "bg-green-500/20 text-green-200 border border-green-500/30 backdrop-blur-sm"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Login Form */}
          <form className="mt-6 flex-1 flex flex-col" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-white/90 mb-1 drop-shadow-md"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none relative block w-full px-4 py-3 bg-white border border-white/30 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent transition duration-150 ease-in-out sm:text-sm"
                  placeholder="admin@compliance.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-white/90 mb-1 drop-shadow-md"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="appearance-none relative block w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 placeholder-white/60 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent transition duration-150 ease-in-out sm:text-sm"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg
                        className="h-5 w-5 text-black/60 hover:text-black/90 transition-colors duration-200"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5 text-black/60 hover:text-black/90 transition-colors duration-200"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 border-white/30 rounded focus:ring-[#8cc63e] bg-white/20"
                  style={{ accentColor: "#8cc63e" }}
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-white/80"
                >
                  Remember me
                </label>
              </div>
            </div>

            {/* Button with proper spacing - added mt-auto and padding */}
            <div className="mt-auto pt-8 pb-2">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8cc63e] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, #8cc63e, #6ab04c)",
                }}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Add CSS animations */}
      <style jsx>{`
        @keyframes borderSlide {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes borderSlideRight {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(100%);
          }
        }

        @keyframes borderSlideBottom {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }

        @keyframes borderSlideLeft {
          0% {
            transform: translateY(100%);
          }
          100% {
            transform: translateY(-100%);
          }
        }

        .animate-border-slide {
          animation: borderSlide 3s linear infinite;
        }

        .animate-border-slide-right {
          animation: borderSlideRight 3s linear infinite;
        }

        .animate-border-slide-bottom {
          animation: borderSlideBottom 3s linear infinite;
        }

        .animate-border-slide-left {
          animation: borderSlideLeft 3s linear infinite;
        }

        /* Hover effect for the card - speeds up animation */
        .max-w-md:hover .animate-border-slide {
          animation-duration: 1.5s;
        }

        .max-w-md:hover .animate-border-slide-right {
          animation-duration: 1.5s;
        }

        .max-w-md:hover .animate-border-slide-bottom {
          animation-duration: 1.5s;
        }

        .max-w-md:hover .animate-border-slide-left {
          animation-duration: 1.5s;
        }

        /* Button hover glow effect */
        .group:hover {
          box-shadow: 0 0 30px rgba(140, 198, 62, 0.3);
        }
      `}</style>
    </div>
  );
};

export default Login;
