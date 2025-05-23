import { Routes, Route, Link } from "react-router-dom";
import { Suspense, lazy } from "react";

const Editor = lazy(() => import("./Editor"));
const About = lazy(() => import("./About"));

function App() {
	return (
		<div>
			<nav style={{ marginBottom: 16 }}>
				<Link to="/">エディタ</Link> |{" "}
				<Link to="/about">このアプリについて</Link>
			</nav>
			<Suspense fallback={<div>Loading...</div>}>
				<Routes>
					<Route path="/" element={<Editor />} />
					<Route path="/about" element={<About />} />
				</Routes>
			</Suspense>
		</div>
	);
}

export default App;
