import { useState } from "react";
import { AppLayout } from "./components/Layout/AppLayout";
import { ServerConfig } from "./pages/ServerConfig/ServerConfig";
import { LogSearch } from "./pages/LogSearch/LogSearch";
import { Overview } from "./pages/Overview/Overview";
import { Settings } from "./pages/Settings/Settings";

function App() {
  const [activePage, setActivePage] = useState("overview");

  const renderPage = () => {
    switch (activePage) {
      case "overview":
        return <Overview />;
      case "log-search":
        return <LogSearch />;
      case "server-config":
        return <ServerConfig />;
      case "settings":
        return <Settings />;
      default:
        return null;
    }
  };

  return (
    <AppLayout activePage={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </AppLayout>
  );
}

export default App;
