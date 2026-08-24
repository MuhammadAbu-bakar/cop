import { useState } from "react";

const Chatbot = () => {

  const [isOpen, setIsOpen] = useState(false);

  // ========================================================
  // UI
  // ========================================================

  return (

    <>

      {/* ====================================================
          CHAT BUTTON
      ==================================================== */}

      <button

        onClick={() =>
          setIsOpen(!isOpen)
        }

        className={`
          fixed
          bottom-6
          right-6
          z-50
          p-4
          rounded-full
          shadow-lg
          transition-all
          duration-300
          transform
          hover:scale-105
          ${
            isOpen
              ? "bg-red-500 hover:bg-red-600 rotate-90"
              : "bg-[#ff0099] hover:bg-[#cc0068]"
          }
          text-white
        `}

      >

        {isOpen ? (

          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >

            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />

          </svg>

        ) : (

          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >

            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />

          </svg>

        )}

      </button>


      {/* ====================================================
          CHAT WINDOW - IFRAME ONLY
      ==================================================== */}

      {isOpen && (

        <div
          className="
            fixed
            bottom-24
            right-6
            z-50
            w-[420px]
            max-w-[calc(100vw-32px)]
            h-[600px]
            max-h-[calc(100vh-120px)]
            bg-white
            rounded-2xl
            shadow-2xl
            flex
            flex-col
            overflow-hidden
            border
            border-gray-200
            animate-slideUp
          "
        >

          {/* =================================================
              HEADER - GREEN BACKGROUND
          ================================================= */}

          <div
            className="
              p-4
              flex
              items-center
              justify-between
              flex-shrink-0
            "
            style={{ backgroundColor: "#8cc63e" }}
          >

            <div
              className="
                flex
                items-center
                space-x-3
              "
            >

              <div
                className="
                  h-10
                  w-10
                  rounded-full
                  bg-[#ff0099]
                  flex
                  items-center
                  justify-center
                "
              >

                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />

                </svg>

              </div>


              <div>

                <h3
                  className="
                    text-white
                    font-semibold
                  "
                >
                  Compliance Assistant
                </h3>

                <p
                  className="
                    text-white/80
                    text-xs
                  "
                >
                  AI Chatbot
                </p>

              </div>

            </div>


            <div
              className="
                flex
                items-center
                gap-2
              "
            >

              <button

                onClick={() =>
                  setIsOpen(false)
                }

                className="
                  text-white/80
                  hover:text-white
                "
              >

                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />

                </svg>

              </button>

            </div>

          </div>

          {/* =================================================
              IFRAME - ZONGA EYE CHATBOT
          ================================================= */}

          <div
            className="
              flex-1
              bg-gray-50
              overflow-hidden
            "
          >
            <iframe
              src="https://zongaeye.zong.com.pk:7863/"
              title="Zonga Eye Chatbot"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          </div>

        </div>

      )}


      {/* =====================================================
          ANIMATION
      ===================================================== */}

      <style jsx>{`

        @keyframes slideUp {

          from {
            opacity: 0;
            transform:
              translateY(20px)
              scale(0.95);
          }

          to {
            opacity: 1;
            transform:
              translateY(0)
              scale(1);
          }

        }

        .animate-slideUp {

          animation:
            slideUp
            0.3s
            ease-out;

        }

      `}</style>

    </>

  );

};


export default Chatbot;