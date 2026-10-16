import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const SidebarContext = createContext({
  collapsed: false,
  toggleSidebar: () => {},
  setCollapsed: () => {},
  isAnimating: false,
  onTransitionEnd: () => {},
});

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsedState] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebarCollapsed");
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [isAnimating, setIsAnimating] = useState(false);
  const animTimeoutRef = useRef(null);

  const startAnimation = useCallback(() => {
    // If reduced motion is preferred, don't enter animating state
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    setIsAnimating(true);
    clearTimeout(animTimeoutRef.current);
    // Safety timer to clear animating state in case transitionend is skipped
    animTimeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
      window.dispatchEvent(new CustomEvent("sidebarTransitionEnd"));
    }, 250);
  }, []);

  const setCollapsed = useCallback((val) => {
    setCollapsedState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      if (next !== prev) {
        startAnimation();
      }
      return next;
    });
  }, [startAnimation]);

  const toggleSidebar = useCallback(() => {
    startAnimation();
    setCollapsedState((prev) => !prev);
  }, [startAnimation]);

  const onTransitionEnd = useCallback((e) => {
    if (e.target?.classList?.contains("app-shell") && e.propertyName === "grid-template-columns") {
      clearTimeout(animTimeoutRef.current);
      setIsAnimating(false);
      window.dispatchEvent(new CustomEvent("sidebarTransitionEnd"));
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("sidebarCollapsed", JSON.stringify(collapsed));
    } catch (e) {
      console.warn("Could not save sidebar state to localStorage:", e);
    }
  }, [collapsed]);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggleSidebar,
        setCollapsed,
        isAnimating,
        onTransitionEnd,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
