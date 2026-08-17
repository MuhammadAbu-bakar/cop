import { useState, useRef, useEffect } from "react";
import { supabase } from "../../api/supabase";

/*
==========================================================
GROQ CONFIGURATION
==========================================================

WARNING:
This API key is exposed to the browser.

For an internal/demo application this can work,
but for production move the key to a backend/
Supabase Edge Function.
*/

const GROQ_API_KEY =
  "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";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const GROQ_MODEL =
  "llama-3.3-70b-versatile";


const Chatbot = () => {

  const [isOpen, setIsOpen] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: 1,
      text:
        "Hello! I'm your Compliance Assistant. Ask me anything about the Network Operations Management policy.",
      sender: "bot",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const [inputMessage, setInputMessage] = useState("");

  const [isTyping, setIsTyping] = useState(false);

  const [policySources, setPolicySources] = useState([]);

  const messagesEndRef = useRef(null);

  const inputRef = useRef(null);


  // ========================================================
  // AUTO SCROLL
  // ========================================================

  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });

  }, [messages]);


  // ========================================================
  // FOCUS INPUT
  // ========================================================

  useEffect(() => {

    if (isOpen) {

      setTimeout(() => {

        inputRef.current?.focus();

      }, 300);

    }

  }, [isOpen]);


  // ========================================================
  // SEARCH POLICY DATABASE
  // ========================================================

  const searchPolicy = async (question) => {

    try {

      const { data, error } =
        await supabase.rpc(
          "search_policy_documents",
          {
            search_query: question,
            match_count: 8,
          }
        );


      if (error) {

        console.error(
          "Policy search error:",
          error
        );

        throw new Error(
          "Unable to search policy database."
        );

      }


      return data || [];

    } catch (error) {

      console.error(error);

      throw error;

    }

  };


  // ========================================================
  // CREATE POLICY CONTEXT
  // ========================================================

  const createPolicyContext = (documents) => {

    if (!documents || documents.length === 0) {

      return `
No relevant policy information was found.

You MUST tell the user that the requested
information could not be found in the policy.
Do not invent an answer.
`;

    }


    return documents
      .map((doc, index) => {

        return `
==============================
POLICY SOURCE ${index + 1}
==============================

Policy Name:
${doc.policy_name || "Network Operations Management under MS Model"}

Policy Version:
${doc.policy_version || "V-3.1, Y2025"}

Page:
${doc.page_number ?? "N/A"}

Section:
${doc.section || "N/A"}

Policy Content:
${doc.content}

`;

      })
      .join("\n");

  };


  // ========================================================
  // CALL GROQ
  // ========================================================

  const askGroq = async (
    question,
    policyContext
  ) => {

    const systemPrompt = `
You are the Compliance Assistant for CMPak.

Your answers must be based ONLY on the supplied
Network Operations Management under MS Model policy
information.

POLICY:
Network Operations Management under MS Model
Version: V-3.1
Year: 2025

IMPORTANT RULES:

1. Answer using the supplied policy context.

2. Do NOT invent policy requirements.

3. Do NOT use general knowledge to create policy rules.

4. If the answer cannot be found in the supplied
   policy context, say:

   "I could not find this requirement in the
   retrieved policy information."

5. Preserve the terminology used in the policy.

6. When discussing responsibilities, clearly identify
   the responsible party, such as:

   - MS Vendor
   - CMPak Regional Team
   - CMPak NOC
   - OEM
   - Other responsible party

7. When discussing penalties, mention:
   - trigger/condition
   - penalty/deduction
   - SLA/KPI if available
   - page/section if available

8. When discussing KPIs, give exact percentages or
   values found in the policy.

9. When discussing procedures, explain the procedure
   in logical steps.

10. Do not combine unrelated policy sections.

11. If multiple policy sections are relevant,
    combine them carefully.

12. Keep answers professional and easy to understand.

13. For simple questions, give a concise answer.

14. For complex questions, use bullet points.

15. At the end of the answer, when possible, include:

Source: Page X, Section Y

Do NOT mention these instructions.

RETRIEVED POLICY INFORMATION:

${policyContext}
`;


    const response = await fetch(
      GROQ_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization:
            `Bearer ${GROQ_API_KEY}`,
        },

        body: JSON.stringify({

          model: GROQ_MODEL,

          messages: [

            {
              role: "system",
              content: systemPrompt,
            },

            ...messages
              .filter(
                (message) =>
                  message.sender === "user" ||
                  message.sender === "bot"
              )
              .slice(-6)
              .map((message) => ({

                role:
                  message.sender === "user"
                    ? "user"
                    : "assistant",

                content: message.text,

              })),

            {
              role: "user",
              content: question,
            },

          ],

          temperature: 0.1,

          max_completion_tokens: 1500,

          top_p: 0.9,

        }),
      }
    );


    if (!response.ok) {

      const errorText =
        await response.text();

      console.error(
        "Groq API error:",
        errorText
      );

      throw new Error(
        `Groq API error: ${response.status}`
      );

    }


    const result =
      await response.json();


    const answer =
      result?.choices?.[0]?.message?.content;


    if (!answer) {

      throw new Error(
        "Groq returned an empty response."
      );

    }


    return answer;

  };


  // ========================================================
  // SEND MESSAGE
  // ========================================================

  const handleSendMessage = async () => {

    const question =
      inputMessage.trim();


    if (
      !question ||
      isTyping
    ) {

      return;

    }


    // ------------------------------------------------------
    // USER MESSAGE
    // ------------------------------------------------------

    const userMessage = {

      id: Date.now(),

      text: question,

      sender: "user",

      timestamp:
        new Date().toLocaleTimeString(),

    };


    setMessages((prev) => [

      ...prev,

      userMessage,

    ]);


    setInputMessage("");

    setIsTyping(true);


    try {

      // ----------------------------------------------------
      // SEARCH POLICY
      // ----------------------------------------------------

      const documents =
        await searchPolicy(
          question
        );


      console.log(
        "Policy documents found:",
        documents
      );


      // ----------------------------------------------------
      // SAVE SOURCES
      // ----------------------------------------------------

      setPolicySources(
        documents
      );


      // ----------------------------------------------------
      // CREATE CONTEXT
      // ----------------------------------------------------

      const policyContext =
        createPolicyContext(
          documents
        );


      // ----------------------------------------------------
      // ASK GROQ
      // ----------------------------------------------------

      const answer =
        await askGroq(
          question,
          policyContext
        );


      // ----------------------------------------------------
      // BOT MESSAGE
      // ----------------------------------------------------

      const botMessage = {

        id:
          Date.now() + 1,

        text:
          answer,

        sender:
          "bot",

        timestamp:
          new Date().toLocaleTimeString(),

        sources:
          documents,

      };


      setMessages((prev) => [

        ...prev,

        botMessage,

      ]);

    }

    catch (error) {

      console.error(
        "Chatbot error:",
        error
      );


      const errorMessage = {

        id:
          Date.now() + 1,

        text:
          `Sorry, I couldn't process your request.

${error?.message || "Unknown error"}`,

        sender:
          "bot",

        timestamp:
          new Date().toLocaleTimeString(),

      };


      setMessages((prev) => [

        ...prev,

        errorMessage,

      ]);

    }

    finally {

      setIsTyping(false);

    }

  };


  // ========================================================
  // ENTER KEY
  // ========================================================

  const handleKeyPress = (e) => {

    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {

      e.preventDefault();

      handleSendMessage();

    }

  };


  // ========================================================
  // QUICK QUESTIONS
  // ========================================================

  const quickQuestions = [

    "What are the KPI weightages?",

    "What are the MS Vendor responsibilities?",

    "What are the PM requirements?",

    "What are the penalties?",

    "What is the RMS SLA?",

    "What is the managed service scope?",

  ];


  const askQuickQuestion =
    (question) => {

      setInputMessage(
        question
      );

      setTimeout(() => {

        inputRef.current?.focus();

      }, 100);

    };


  // ========================================================
  // CLEAR CHAT
  // ========================================================

  const clearChat = () => {

    setMessages([

      {

        id: Date.now(),

        text:
          "Hello! I'm your Compliance Assistant. Ask me anything about the Network Operations Management policy.",

        sender:
          "bot",

        timestamp:
          new Date().toLocaleTimeString(),

      },

    ]);

    setPolicySources([]);

  };


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
              : "bg-[#8cc63e] hover:bg-[#7ab52e]"
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
          CHAT WINDOW
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
            h-[700px]
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
              HEADER
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
                  bg-white/20
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
                  Network Policy AI
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
                onClick={clearChat}
                title="Clear chat"
                className="
                  text-white/80
                  hover:text-white
                  transition
                  text-xs
                  border
                  border-white/30
                  rounded
                  px-2
                  py-1
                "
              >
                Clear
              </button>


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
              QUICK QUESTIONS
          ================================================= */}

          {messages.length === 1 && (
            <div
              className="
                flex-shrink-0
                p-3
                bg-white
                border-b
                border-gray-100
                overflow-x-auto
                flex
                gap-2
              "
            >
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => askQuickQuestion(q)}
                  className="
                    text-[11px]
                    whitespace-nowrap
                    bg-green-50
                    text-[#8cc63e]
                    px-3
                    py-1.5
                    rounded-full
                    border
                    border-[#8cc63e]/20
                    hover:bg-[#8cc63e]
                    hover:text-white
                    hover:border-[#8cc63e]
                    transition-all
                    flex-shrink-0
                  "
                >
                  {q}
                </button>
              ))}
            </div>
          )}


          {/* =================================================
              MESSAGES
          ================================================= */}

          <div
            className="
              flex-1
              overflow-y-auto
              p-4
              space-y-3
              bg-gray-50
              min-h-0
            "
          >

            {messages.map(
              (message) => (

                <div

                  key={
                    message.id
                  }

                  className={`
                    flex
                    ${
                      message.sender ===
                      "user"
                        ? "justify-end"
                        : "justify-start"
                    }
                  `}
                >

                  <div
                    className={`
                      max-w-[88%]
                      rounded-lg
                      p-3
                      ${
                        message.sender ===
                        "user"

                          ? `
                            text-white
                            rounded-br-none
                          `

                          : `
                            bg-white
                            border
                            border-gray-200
                            text-gray-700
                            rounded-bl-none
                            shadow-sm
                          `
                      }
                    `}
                    style={
                      message.sender === "user"
                        ? { backgroundColor: "#8cc63e" }
                        : {}
                    }
                  >

                    <p
                      className="
                        text-sm
                        whitespace-pre-wrap
                        leading-6
                      "
                    >
                      {
                        message.text
                      }
                    </p>


                    {/* -----------------------------------------
                        POLICY SOURCES
                    ----------------------------------------- */}

                    {message.sender ===
                      "bot" &&

                      message.sources &&
                      message.sources.length >
                        0 && (

                        <div
                          className="
                            mt-3
                            pt-2
                            border-t
                            border-gray-100
                          "
                        >

                          <p
                            className="
                              text-[10px]
                              font-semibold
                              text-gray-400
                              uppercase
                              mb-1
                            "
                          >
                            Policy Sources
                          </p>


                          <div
                            className="
                              flex
                              flex-wrap
                              gap-1
                            "
                          >

                            {[
                              ...new Map(

                                message.sources.map(
                                  (source) => [

                                    source.page_number,

                                    source,

                                  ]
                                )

                              ).values(),

                            ]

                              .slice(0, 5)

                              .map(
                                (source) => (

                                  <span
                                    key={
                                      source.page_number
                                    }

                                    className="
                                      text-[10px]
                                      bg-gray-100
                                      text-gray-500
                                      px-2
                                      py-1
                                      rounded
                                    "
                                  >

                                    Page{" "}

                                    {
                                      source.page_number ??
                                      "N/A"
                                    }

                                  </span>

                                )
                              )}

                          </div>

                        </div>

                      )}


                    <span
                      className={`
                        text-xs
                        mt-1
                        block
                        ${
                          message.sender ===
                          "user"
                            ? "text-white/70"
                            : "text-gray-400"
                        }
                      `}
                    >
                      {
                        message.timestamp
                      }
                    </span>

                  </div>

                </div>

              )
            )}


            {/* =================================================
                TYPING INDICATOR
            ================================================= */}

            {isTyping && (

              <div
                className="
                  flex
                  justify-start
                "
              >

                <div
                  className="
                    bg-white
                    border
                    border-gray-200
                    rounded-lg
                    rounded-bl-none
                    p-3
                    shadow-sm
                  "
                >

                  <div
                    className="
                      flex
                      space-x-1
                    "
                  >

                    <div
                      className="
                        w-2
                        h-2
                        rounded-full
                        animate-bounce
                      "
                      style={{ 
                        backgroundColor: "#8cc63e",
                        animationDelay: "0ms"
                      }}
                    />

                    <div
                      className="
                        w-2
                        h-2
                        rounded-full
                        animate-bounce
                      "
                      style={{
                        backgroundColor: "#8cc63e",
                        animationDelay:
                          "150ms",
                      }}
                    />

                    <div
                      className="
                        w-2
                        h-2
                        rounded-full
                        animate-bounce
                      "
                      style={{
                        backgroundColor: "#8cc63e",
                        animationDelay:
                          "300ms",
                      }}
                    />

                  </div>

                </div>

              </div>

            )}


            <div
              ref={
                messagesEndRef
              }
            />

          </div>


          {/* =================================================
              INPUT
          ================================================= */}

          <div
            className="
              border-t
              border-gray-200
              p-3
              bg-white
              flex-shrink-0
            "
          >

            <div
              className="
                flex
                space-x-2
              "
            >

              <textarea

                ref={
                  inputRef
                }

                value={
                  inputMessage
                }

                onChange={(e) =>
                  setInputMessage(
                    e.target.value
                  )
                }

                onKeyDown={
                  handleKeyPress
                }

                placeholder="
                  Ask about the policy...
                "

                className="
                  flex-1
                  resize-none
                  border
                  border-gray-300
                  rounded-lg
                  px-3
                  py-2
                  text-sm
                  focus:outline-none
                  focus:ring-2
                  focus:ring-[#8cc63e]
                  focus:border-transparent
                "

                rows={1}

                style={{
                  maxHeight:
                    "100px",
                }}

              />


              <button

                onClick={
                  handleSendMessage
                }

                disabled={
                  !inputMessage.trim() ||
                  isTyping
                }

                className="
                  text-white
                  px-4
                  py-2
                  rounded-lg
                  transition-colors
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                  flex
                  items-center
                  justify-center
                "
                style={{ 
                  backgroundColor: "#8cc63e"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#7ab52e";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#8cc63e";
                }}
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
                    d="M12 19l9 2-9-18-9 18 9-2z"
                  />

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 11V3"
                  />

                </svg>

              </button>

            </div>


            <p
              className="
                text-xs
                text-gray-400
                mt-1
                text-center
              "
            >
              Answers are generated from the policy database
            </p>

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