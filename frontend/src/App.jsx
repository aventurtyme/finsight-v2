import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar                  from './components/Navbar';
import Home                    from './pages/Home';
import Report                  from './pages/Report';
import Sentiment               from './pages/Sentiment';
import About                   from './pages/About';
import EvaluationHub           from './pages/EvaluationHub';
import EvaluationAccuracy      from './pages/EvaluationAccuracy';
import EvaluationCalibration   from './pages/EvaluationCalibration';
import EvaluationSectors       from './pages/EvaluationSectors';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"                          element={<Home />} />
        <Route path="/report/:ticker"            element={<Report />} />
        <Route path="/sentiment"                 element={<Sentiment />} />
        <Route path="/about"                     element={<About />} />
        <Route path="/evaluation"                element={<EvaluationHub />} />
        <Route path="/evaluation/accuracy"       element={<EvaluationAccuracy />} />
        <Route path="/evaluation/calibration"    element={<EvaluationCalibration />} />
        <Route path="/evaluation/sectors"        element={<EvaluationSectors />} />
      </Routes>
    </BrowserRouter>
  );
}