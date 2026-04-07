import Image from "next/image";

import logo from "@/resources/images/logo.png";

interface LogoProps {
  className?: string;
}

const Logo = ({ className }: LogoProps) => {
  return (
    <Image
      src={logo}
      alt="Logo"
      width={80}
      height={80}
      className={className}
      priority
    />
  );
};

export default Logo;
