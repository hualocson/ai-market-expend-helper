import type { ReactNode } from "react";

const AppMain = ({ children }: { children: ReactNode }) => {
  return <main className="pb-24">{children}</main>;
};

export default AppMain;
