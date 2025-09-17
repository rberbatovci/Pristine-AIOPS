// src/components/common/Notification.js
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Notification({ message, type = "info", onClose }) {
  useEffect(() => {
    if (type === "loading") return; // don't auto-close for loading
    const timer = setTimeout(() => {
      onClose();
    }, 4000); // auto close after 4s
    return () => clearTimeout(timer);
  }, [onClose, type]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: "fixed",
            top: 20,
            width: "450px",
            left: "calc(50% - 225px)",
            transform: "translateX(-50%)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "var(--contentBackground)",
            backdropFilter: "blur(25px)",
            color: "white",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            fontWeight: "500",
            minWidth: "250px",
            textAlign: "center",
          }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
