import { Route, Routes } from "react-router-dom";
import Lobby from "./pages/Lobby";
import RoomPage from "./pages/RoomPage";
import { SoundToggle } from "./components/SoundToggle";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/room/:code?" element={<RoomPage />} />
      </Routes>
      <SoundToggle />
    </>
  );
}
