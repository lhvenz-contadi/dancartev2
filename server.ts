import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "DancArte API is running" });
  });

  // Mock data for the demo
  const students = [
    { id: 1, name: "Ana Paula Oliveira", age: 8, responsible: "Cláudia Oliveira", class: "Ballet Baby - A", status: "Ativo", payment: "Em dia", email: "ana.paula@email.com" },
    { id: 2, name: "Beatriz Silva", age: 12, responsible: "Ricardo Silva", class: "Jazz Infantil - B", status: "Ativo", payment: "Pendente", email: "contato.silva@email.com" },
    { id: 3, name: "Clara Mendes", age: 15, responsible: "Sônia Mendes", class: "Contemporâneo - C", status: "Inativo", payment: "Em dia", email: "mendes.clara@email.com" },
    { id: 4, name: "Daniel Costa", age: 10, responsible: "Marcos Costa", class: "Sapateado - A", status: "Ativo", payment: "Em dia", email: "daniel@familiacosta.com.br" },
    { id: 5, name: "Julia Ferreira", age: 17, responsible: "Própria", class: "Ballet Adulto - Inter", status: "Ativo", payment: "Pendente", email: "ferreira.julia@email.com" },
  ];

  app.get("/api/students", (req, res) => {
    res.json(students);
  });

  app.get("/api/stats", (req, res) => {
    res.json({
      totalStudents: 87,
      monthlyRevenue: 15400,
      delinquencyRate: 8,
      occupancyRate: 92,
      revenueHistory: [
        { month: "Jan", value: 45 },
        { month: "Fev", value: 65 },
        { month: "Mar", value: 55 },
        { month: "Abr", value: 75 },
        { month: "Mai", value: 40 },
        { month: "Jun", value: 90 },
      ]
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
