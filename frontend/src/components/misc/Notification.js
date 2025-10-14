import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function Notification({ message, type = "info", onClose }) {
  useEffect(() => {
    if (type === "loading") return; // keep loading visible until manually closed
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose, type]);

  const getBackground = () => {
    switch (type) {
      case "success":
        return "rgba(34, 197, 94, 0.15)";
      case "error":
        return "rgba(239, 68, 68, 0.15)";
      case "loading":
        return "rgba(59, 130, 246, 0.15)";
      default:
        return "rgba(255,255,255,0.08)";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <CheckCircle className="text-green-400" size={28} />
          </motion.div>
        );
      case "error":
        return (
          <motion.div
            initial={{ x: -5 }}
            animate={{ x: [0, -10, 10, -8, 8, -4, 4, 0] }}
            transition={{ duration: 0.6 }}
          >
            <XCircle className="text-red-400" size={28} />
          </motion.div>
        );
      case "loading":
        return (
          <motion.div
            style={{
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transformOrigin: "center", // ✅ ensures perfect center rotation
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          >
            <Loader2 className="text-blue-400" size={26} />
          </motion.div>
        );
      default:
        return null;
    }
  };

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
            left: "calc(50% - 250px)",
            transform: "translateX(-50%)",
            zIndex: 1000,
            width: "500px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "var(--contentBackground)",
            backdropFilter: "blur(25px)",
            color: "white",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            fontWeight: "500",
            minWidth: "250px",
            textAlign: "left",
            padding: "25px",
          }}
        >
          {getIcon()}
          <motion.span
            key={message}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {message}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
