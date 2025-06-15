import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import "./App.css";

const Editor = lazy(() => import("./Editor"));
const About = lazy(() => import("./About"));

function App() {
	const location = useLocation();
	return (
		<div className="flex flex-col h-screen bg-background">
			<header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<nav className="flex h-full items-center px-6 gap-6">
					<div className="flex items-center gap-2">
						<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
							<span className="text-primary-foreground font-bold text-sm">P</span>
						</div>
						<span className="font-semibold text-lg">Playmaker</span>
					</div>
					<div className="h-8 w-px bg-border" />
					<div className="flex gap-1">
						<Link
							to="/"
							className="px-3 py-1.5 text-sm font-medium transition-colors hover:text-foreground text-muted-foreground data-[active=true]:text-foreground data-[active=true]:bg-accent rounded-md"
							data-active={location.pathname === "/"}
						>
							エディター
						</Link>
						<Link
							to="/about"
							className="px-3 py-1.5 text-sm font-medium transition-colors hover:text-foreground text-muted-foreground data-[active=true]:text-foreground data-[active=true]:bg-accent rounded-md"
							data-active={location.pathname === "/about"}
						>
							このアプリについて
						</Link>
					</div>
				</nav>
			</header>
			<main className="flex-1 overflow-hidden">
				<Suspense fallback={<div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading...</div></div>}>
					<Routes>
						<Route path="/" element={<Editor />} />
						<Route path="/about" element={<About />} />
					</Routes>
				</Suspense>
			</main>
		</div>
	);
}

export default App;
