import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar         from './components/Navbar';
import Home           from './pages/Home';
import Report         from './pages/Report';
import Sentiment      from './pages/Sentiment';
import About          from './pages/About';
import EvaluationHub  from './pages/EvaluationHub';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"                    element={<Home />} />
        <Route path="/report/:ticker"      element={<Report />} />
        <Route path="/sentiment"           element={<Sentiment />} />
        <Route path="/about"               element={<About />} />
        <Route path="/evaluation"          element={<EvaluationHub />} />
      </Routes>
    </BrowserRouter>
  );
}