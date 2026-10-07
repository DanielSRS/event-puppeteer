import React, { useEffect } from "react";
import { MdClose } from "react-icons/md";

export type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: "md" | "lg" | "xl";
};

export function Drawer({ isOpen, onClose, title, children, width = "md" }: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const widthClasses = {
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer Panel */}
      <div className={`relative w-full ${widthClasses[width]} bg-background shadow-2xl h-full flex flex-col animate-in slide-in-from-right-full duration-300`}>
        <header className="between p-4 border-b border-muted">
          <h2 className="title text-lg">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-white/5 transition-colors"
            title="Fechar"
          >
            <MdClose className="icon" />
          </button>
        </header>
        
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
