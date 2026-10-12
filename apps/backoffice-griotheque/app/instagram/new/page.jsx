"use client";
import AutomationForm from "../../components/AutomationForm";

export default function NouvelleAutomation() {
  return (
    <div className="bo-page">
      <div className="bo-tete"><div className="bo-tete__gauche">
        <div className="bo-fil"><a href="/instagram">Instagram</a> / nouvelle</div>
        <h1>Nouvelle automatisation</h1>
      </div></div>
      <AutomationForm initial={null} isNew />
    </div>
  );
}
