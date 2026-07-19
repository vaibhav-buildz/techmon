import React from "react";

export default function ThreeColumnLayout({
  children,
  leftColumn,
  rightColumn
}: {
  children: React.ReactNode;
  leftColumn?: React.ReactNode;
  rightColumn?: React.ReactNode;
}) {
  return (
    <div className="max-w-7xl mx-auto w-full flex justify-center gap-6 px-4 py-6 md:py-8">
      {/* Left Column */}
      {leftColumn && (
        <div className="hidden lg:block w-[250px] shrink-0">
          <div className="sticky top-24 space-y-4">
            {leftColumn}
          </div>
        </div>
      )}
      
      {/* Center Column */}
      <div className="flex-1 max-w-[600px] w-full min-w-0">
        {children}
      </div>

      {/* Right Column */}
      {rightColumn && (
        <div className="hidden xl:block w-[300px] shrink-0">
          <div className="sticky top-24 space-y-4">
            {rightColumn}
          </div>
        </div>
      )}
    </div>
  );
}
