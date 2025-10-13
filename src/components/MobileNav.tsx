import { useNavigate, useLocation } from "react-router-dom";
import { Home, ArrowLeftRight, CreditCard, User, Store, Trophy } from "lucide-react";
import finmoLogo from "@/assets/finmo-logo.png";

const MobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Trophy, label: "Rewards", path: "/rewards" },
    { icon: ArrowLeftRight, label: "P2P", path: "/p2p" },
    { icon: Store, label: "Market", path: "/marketplace" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-finmo-lg md:hidden">
      <nav className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : ""}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileNav;
