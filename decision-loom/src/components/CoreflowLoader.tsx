"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionStore } from "@/store/session";

const COREFLOW_STEPS = [
  { letter: "C", word: "Context", description: "Who is this for and why now?" },
  { letter: "O", word: "Outcome", description: "What does success look like?" },
  { letter: "R", word: "Risks", description: "What could go wrong?" },
  { letter: "E", word: "Experience", description: "How should it feel?" },
  { letter: "F", word: "Flow", description: "What's the user journey?" },
  { letter: "L", word: "Limits", description: "What are we cutting?" },
  { letter: "O", word: "Operations", description: "How does it stay healthy?" },
  { letter: "W", word: "Wins", description: "How do we measure success?" },
];

const STEP_DURATION = 2000; // 2 seconds per step
const MIN_DISPLAY_TIME = 4000; // Minimum 4 seconds before allowing close

export function CoreflowLoader() {
  const { isPrefilling } = useSessionStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasCompletedMinTime, setHasCompletedMinTime] = useState(false);
  const hasStartedRef = useRef(false);

  // Show loader when prefilling starts
  useEffect(() => {
    if (isPrefilling && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setIsVisible(true);
      setHasCompletedMinTime(false);
      
      // Start minimum time timer
      const timer = setTimeout(() => {
        setHasCompletedMinTime(true);
      }, MIN_DISPLAY_TIME);
      
      return () => clearTimeout(timer);
    }
  }, [isPrefilling]);

  // Cycle through steps
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % COREFLOW_STEPS.length);
    }, STEP_DURATION);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Hide when prefilling is done AND minimum time has passed
  useEffect(() => {
    if (!isPrefilling && hasCompletedMinTime && isVisible) {
      // Add a small delay for smooth transition
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPrefilling, hasCompletedMinTime, isVisible]);

  if (!isVisible) return null;

  const step = COREFLOW_STEPS[currentStep];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#F9F7F2]/95 backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-8 max-w-lg px-8">
          {/* COREFLOW letter display */}
          <div className="flex gap-1">
            {COREFLOW_STEPS.map((s, i) => (
              <motion.span
                key={i}
                className={`text-4xl font-bold font-['Libre_Baskerville'] transition-colors duration-300 ${
                  i === currentStep
                    ? "text-[#8C7B50]"
                    : i < currentStep
                    ? "text-[#8C7B50]/40"
                    : "text-[#1C1C1C]/20"
                }`}
                animate={{
                  scale: i === currentStep ? 1.2 : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                {s.letter}
              </motion.span>
            ))}
          </div>

          {/* Current step details */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold font-['Libre_Baskerville'] text-[#1C1C1C] mb-2">
              {step.word}
            </h2>
            <p className="text-lg font-['Inter'] text-[#1C1C1C]/70">
              {step.description}
            </p>
          </motion.div>

          {/* Progress indicator */}
          <div className="flex gap-2 mt-4">
            {COREFLOW_STEPS.map((_, i) => (
              <motion.div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? "w-8 bg-[#8C7B50]"
                    : i < currentStep
                    ? "w-2 bg-[#8C7B50]/40"
                    : "w-2 bg-[#1C1C1C]/20"
                }`}
              />
            ))}
          </div>

          {/* Loading message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm font-['Inter'] text-[#1C1C1C]/50 mt-8"
          >
            {isPrefilling
              ? "Analyzing your product idea..."
              : "Almost ready..."}
          </motion.p>

          {/* Subtle spinner */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 border-2 border-[#8C7B50]/20 border-t-[#8C7B50] rounded-full"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
