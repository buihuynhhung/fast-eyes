import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background cyber-grid flex items-center justify-center p-4">
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline pointer-events-none z-10" />

      {/* Background glow effects */}
      <div className="fixed top-1/2 left-1/2 w-96 h-96 bg-destructive/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-20 text-center space-y-6"
      >
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
        >
          <AlertTriangle className="w-20 h-20 mx-auto text-destructive" />
        </motion.div>

        <h1 className="font-display text-6xl md:text-8xl text-primary neon-text glitch-text">
          404
        </h1>

        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          This page has been lost in the digital void. Return to safety.
        </p>

        <Link to="/">
          <Button className="bg-primary hover:bg-primary/80 text-primary-foreground font-display text-lg px-8 py-6">
            <Home className="w-5 h-5 mr-2" />
            RETURN HOME
          </Button>
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
