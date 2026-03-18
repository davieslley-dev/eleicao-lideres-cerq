import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Vote, UserPlus, BarChart3, ShieldCheck, PlusCircle, Users, ImagePlus, Link2, School } from "lucide-react";
import { motion } from "framer-motion";

const uid = () => Math.random().toString(36).slice(2, 10);

const formatCPF = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const cleanCPF = (cpf) => cpf.replace(/\D/g, "");

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const DEFAULT_POSITIONS = [
  "Líder",
  "Vice-líder",
  "Representante Indígena",
  "Representante LGBTQIA+",
  "Representante de Segmento",
];

const initialData = {
  elections: [
    {
      id: uid(),
      schoolName: "Colégio Estadual Rodolfo de Queiroz",
      className: "1º Ano A",
      title: "Eleição da Turma 1º Ano A",
      description: "Escolha da representação estudantil da turma.",
      status: "aberta",
      accessCode: "1anoa-rodolfo-queiroz",
      positions: DEFAULT_POSITIONS,
      candidates: [
        {
          id: uid(),
          name: "Ana Clara",
          position: "Líder",
          number: "10",
          photo: "",
        },
        {
          id: uid(),
          name: "João Pedro",
          position: "Vice-líder",
          number: "20",
          photo: "",
        },
      ],
      votes: [],
    },
  ],
};

const ADMIN_PASSWORD = "admin123";
const STORAGE_KEY = "sistema-votacao-rodolfo-queiroz";

function App() {
  const [data, setData] = useState(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return saved ? JSON.parse(saved) : initialData;
  });
  const [adminSchoolName, setAdminSchoolName] = useState("Colégio Estadual Rodolfo de Queiroz");
  const [adminClassName, setAdminClassName] = useState("");
  const [adminTitle, setAdminTitle] = useState("");
  const [adminDescription, setAdminDescription] = useState("");
  const [adminPositions, setAdminPositions] = useState(DEFAULT_POSITIONS.join(", "));
  const [selectedElectionId, setSelectedElectionId] = useState(initialData.elections[0]?.id || "");
  const [candidateName, setCandidateName] = useState("");
  const [candidatePosition, setCandidatePosition] = useState("");
  const [candidateNumber, setCandidateNumber] = useState("");
  const [candidatePhoto, setCandidatePhoto] = useState("");

  const [accessCodeInput, setAccessCodeInput] = useState(initialData.elections[0]?.accessCode || "");
  const [authenticatedElectionId, setAuthenticatedElectionId] = useState(initialData.elections[0]?.id || "");
  const [voterName, setVoterName] = useState("");
  const [voterCPF, setVoterCPF] = useState("");
  const [selectedVotes, setSelectedVotes] = useState({});
  const [message, setMessage] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentPath, setCurrentPath] = useState(typeof window !== "undefined" ? window.location.pathname : "/admin");

  const elections = data.elections;

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncRoute = () => {
      setCurrentPath(window.location.pathname || "/admin");
      const parts = (window.location.pathname || "").split("/").filter(Boolean);
      if (parts[0] === "votacao" && parts[1]) {
        const election = data.elections.find((e) => e.accessCode === parts[1]);
        if (election) {
          setAuthenticatedElectionId(election.id);
          setAccessCodeInput(election.accessCode);
        }
      }
    };

    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, [data.elections]);

  const navigateTo = (path) => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", path);
      setCurrentPath(path);
    }
  };

  const isVotingPage = currentPath.startsWith("/votacao/");

  const selectedAdminElection = useMemo(
    () => elections.find((e) => e.id === selectedElectionId),
    [elections, selectedElectionId]
  );

  const authenticatedElection = useMemo(
    () => elections.find((e) => e.id === authenticatedElectionId),
    [elections, authenticatedElectionId]
  );

  const totalVotesAll = elections.reduce((acc, election) => acc + election.votes.length, 0);
  const totalCandidatesAll = elections.reduce((acc, election) => acc + election.candidates.length, 0);

  const addElection = () => {
    if (!adminClassName.trim()) {
      setMessage("Informe a turma para criar a eleição.");
      return;
    }

    const positions = adminPositions
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (positions.length === 0) {
      setMessage("Cadastre pelo menos um cargo para a turma.");
      return;
    }

    const classLabel = adminClassName.trim();
    const generatedCode = `${slugify(classLabel)}-${uid().slice(0, 4)}`;
    const newElection = {
      id: uid(),
      schoolName: adminSchoolName.trim() || "Colégio Estadual Rodolfo de Queiroz",
      className: classLabel,
      title: adminTitle.trim() || `Eleição da Turma ${classLabel}`,
      description: adminDescription.trim(),
      status: "aberta",
      accessCode: generatedCode,
      positions,
      candidates: [],
      votes: [],
    };

    setData((prev) => ({
      ...prev,
      elections: [...prev.elections, newElection],
    }));

    setSelectedElectionId(newElection.id);
    setAuthenticatedElectionId(newElection.id);
    setAccessCodeInput(newElection.accessCode);
    setAdminClassName("");
    setAdminTitle("");
    setAdminDescription("");
    setAdminPositions(DEFAULT_POSITIONS.join(", "));
    setMessage(`Eleição cadastrada com sucesso. Link da turma: /votacao/${newElection.accessCode}`);
  };

  const removeElection = (electionId) => {
    const remaining = elections.filter((e) => e.id !== electionId);
    setData((prev) => ({
      ...prev,
      elections: remaining,
    }));
    setSelectedElectionId(remaining[0]?.id || "");
    setAuthenticatedElectionId(remaining[0]?.id || "");
    setAccessCodeInput(remaining[0]?.accessCode || "");
    setSelectedVotes({});
  };

  const toggleElectionStatus = (electionId) => {
    setData((prev) => ({
      ...prev,
      elections: prev.elections.map((e) =>
        e.id === electionId
          ? { ...e, status: e.status === "aberta" ? "encerrada" : "aberta" }
          : e
      ),
    }));
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCandidatePhoto(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const addCandidate = () => {
    if (!selectedAdminElection || !candidateName.trim() || !candidatePosition.trim()) {
      setMessage("Informe nome e cargo do candidato.");
      return;
    }

    if (!selectedAdminElection.positions.includes(candidatePosition)) {
      setMessage("Escolha um cargo válido da eleição da turma.");
      return;
    }

    const newCandidate = {
      id: uid(),
      name: candidateName.trim(),
      position: candidatePosition,
      number: candidateNumber.trim() || String(selectedAdminElection.candidates.length + 1),
      photo: candidatePhoto,
    };

    setData((prev) => ({
      ...prev,
      elections: prev.elections.map((e) =>
        e.id === selectedAdminElection.id
          ? { ...e, candidates: [...e.candidates, newCandidate] }
          : e
      ),
    }));

    setCandidateName("");
    setCandidatePosition("");
    setCandidateNumber("");
    setCandidatePhoto("");
    setMessage("Candidato cadastrado com sucesso.");
  };

  const removeCandidate = (electionId, candidateId) => {
    setData((prev) => ({
      ...prev,
      elections: prev.elections.map((e) =>
        e.id === electionId
          ? { ...e, candidates: e.candidates.filter((c) => c.id !== candidateId) }
          : e
      ),
    }));

    setSelectedVotes((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((position) => {
        if (next[position] === candidateId) delete next[position];
      });
      return next;
    });
  };

  const accessElectionByCode = () => {
    const normalizedCode = accessCodeInput.trim().replace("/votacao/", "");
    const election = elections.find((e) => e.accessCode === normalizedCode);
    if (!election) {
      setMessage("Código ou link da turma não encontrado.");
      return;
    }
    setAuthenticatedElectionId(election.id);
    setSelectedVotes({});
    navigateTo(`/votacao/${election.accessCode}`);
    setMessage(`Acesso liberado para a turma ${election.className}.`);
  };

  const submitVote = () => {
    const clean = cleanCPF(voterCPF);

    if (!voterName.trim() || clean.length !== 11 || !authenticatedElection) {
      setMessage("Preencha nome, CPF e acesse a votação da turma corretamente.");
      return;
    }

    if (authenticatedElection.status !== "aberta") {
      setMessage("Esta eleição está encerrada e não recebe novos votos.");
      return;
    }

    const missingPositions = authenticatedElection.positions.filter((position) => !selectedVotes[position]);
    if (missingPositions.length > 0) {
      setMessage("É necessário escolher um único candidato para cada cargo da turma.");
      return;
    }

    const alreadyVoted = authenticatedElection.votes.some((v) => v.cpf === clean);
    if (alreadyVoted) {
      setMessage("Este CPF já votou nesta eleição da turma.");
      return;
    }

    const voteEntries = authenticatedElection.positions.map((position) => ({
      position,
      candidateId: selectedVotes[position],
    }));

    setData((prev) => ({
      ...prev,
      elections: prev.elections.map((e) =>
        e.id === authenticatedElection.id
          ? {
              ...e,
              votes: [
                ...e.votes,
                {
                  id: uid(),
                  voterName: voterName.trim(),
                  cpf: clean,
                  choices: voteEntries,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : e
      ),
    }));

    setVoterName("");
    setVoterCPF("");
    setSelectedVotes({});
    setMessage("Voto registrado com sucesso para todos os cargos da turma.");
  };

  const getElectionResults = (election) => {
    return election.positions.map((position) => {
      const candidates = election.candidates.filter((candidate) => candidate.position === position);
      const totalVotesForPosition = election.votes.length;

      const ranked = candidates
        .map((candidate) => {
          const votes = election.votes.filter((vote) =>
            vote.choices.some((choice) => choice.position === position && choice.candidateId === candidate.id)
          ).length;
          const percent = totalVotesForPosition > 0 ? ((votes / totalVotesForPosition) * 100).toFixed(1) : "0.0";
          return { ...candidate, votes, percent };
        })
        .sort((a, b) => b.votes - a.votes);

      return {
        position,
        totalVotesForPosition,
        ranked,
      };
    });
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      navigateTo("/admin");
      setMessage("Acesso administrativo liberado.");
    } else {
      setMessage("Senha de administrador incorreta.");
    }
  };

  const handleLogout = () => {
    setIsAdminAuthenticated(false);
    setAdminPassword("");
    navigateTo("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-xl"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Sistema de Eleição de Líderes de Turma</h1>
              <p className="mt-2 text-sm text-slate-200 md:text-base">
                Colégio Estadual Rodolfo de Queiroz — eleições separadas por turma, com link exclusivo, cargos específicos, fotos dos candidatos e apuração por função.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Turmas" value={String(elections.length)} icon={<School className="h-5 w-5" />} />
              <StatCard label="Candidatos" value={String(totalCandidatesAll)} icon={<Users className="h-5 w-5" />} />
              <StatCard label="Votantes" value={String(totalVotesAll)} icon={<Vote className="h-5 w-5" />} />
            </div>
          </div>
        </motion.div>

        {message && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            {message}
          </div>
        )}

        {!isVotingPage ? (
          !isAdminAuthenticated ? (
            <Card className="mx-auto max-w-lg rounded-3xl shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="h-5 w-5" /> Acesso do administrador
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  Somente a administração do Colégio Estadual Rodolfo de Queiroz pode acessar o cadastro de eleições, candidatos e a apuração completa.
                </div>
                <div className="space-y-2">
                  <Label>Senha do administrador</Label>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Digite a senha"
                  />
                </div>
                <Button className="w-full rounded-2xl" onClick={handleAdminLogin}>
                  Entrar no painel administrativo
                </Button>
                <p className="text-xs text-slate-500">
                  Senha de demonstração atual no código: <strong>admin123</strong>. Altere antes de publicar.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="admin" className="w-full">
              <div className="mb-4 flex justify-end">
                <Button variant="outline" className="rounded-2xl" onClick={handleLogout}>
                  Sair da administração
                </Button>
              </div>
              <TabsList className="grid w-full grid-cols-2 rounded-2xl">
                <TabsTrigger value="admin">Administrador</TabsTrigger>
                <TabsTrigger value="results">Apuração</TabsTrigger>
              </TabsList>

              <TabsContent value="admin" className="mt-6 space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="rounded-3xl shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <PlusCircle className="h-5 w-5" /> Nova eleição por turma
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome da escola</Label>
                        <Input value={adminSchoolName} onChange={(e) => setAdminSchoolName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Turma</Label>
                        <Input
                          value={adminClassName}
                          onChange={(e) => setAdminClassName(e.target.value)}
                          placeholder="Ex.: 2º Ano B"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Título da eleição</Label>
                        <Input
                          value={adminTitle}
                          onChange={(e) => setAdminTitle(e.target.value)}
                          placeholder="Ex.: Eleição de Representantes da Turma"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Input
                          value={adminDescription}
                          onChange={(e) => setAdminDescription(e.target.value)}
                          placeholder="Descreva o objetivo da votação"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cargos da turma</Label>
                        <Input
                          value={adminPositions}
                          onChange={(e) => setAdminPositions(e.target.value)}
                          placeholder="Líder, Vice-líder, Representante Indígena, Representante LGBTQIA+"
                        />
                        <p className="text-xs text-slate-500">Separe os cargos por vírgula. O eleitor votará uma única vez em um candidato para cada cargo.</p>
                      </div>
                      <Button className="w-full rounded-2xl" onClick={addElection}>
                        Cadastrar eleição da turma
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <UserPlus className="h-5 w-5" /> Cadastrar candidato
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Selecione a turma</Label>
                        <Select value={selectedElectionId} onValueChange={setSelectedElectionId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Escolha uma turma" />
                          </SelectTrigger>
                          <SelectContent>
                            {elections.map((election) => (
                              <SelectItem key={election.id} value={election.id}>
                                {election.className}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nome do candidato</Label>
                        <Input
                          value={candidateName}
                          onChange={(e) => setCandidateName(e.target.value)}
                          placeholder="Nome completo do estudante"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cargo disputado</Label>
                        <Select value={candidatePosition} onValueChange={setCandidatePosition}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um cargo" />
                          </SelectTrigger>
                          <SelectContent>
                            {(selectedAdminElection?.positions || []).map((position) => (
                              <SelectItem key={position} value={position}>
                                {position}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Número do candidato</Label>
                        <Input
                          value={candidateNumber}
                          onChange={(e) => setCandidateNumber(e.target.value)}
                          placeholder="Ex.: 15"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Foto do candidato</Label>
                        <Input type="file" accept="image/*" onChange={handlePhotoUpload} />
                        {candidatePhoto && (
                          <div className="flex items-center gap-3 rounded-2xl border p-3">
                            <img src={candidatePhoto} alt="Pré-visualização" className="h-14 w-14 rounded-full object-cover" />
                            <span className="text-sm text-slate-600">Foto carregada com sucesso.</span>
                          </div>
                        )}
                      </div>
                      <Button className="w-full rounded-2xl" onClick={addCandidate}>
                        Adicionar candidato
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-3xl shadow-md">
                  <CardHeader>
                    <CardTitle>Painel das turmas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {elections.map((election) => (
                        <motion.div
                          key={election.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="rounded-3xl border bg-slate-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold">{election.className}</h3>
                              <p className="mt-1 text-sm text-slate-600">{election.title}</p>
                              <p className="mt-1 text-xs text-slate-500">{election.schoolName}</p>
                            </div>
                            <Badge variant={election.status === "aberta" ? "default" : "secondary"}>
                              {election.status}
                            </Badge>
                          </div>

                          <Separator className="my-4" />

                          <div className="space-y-2 text-sm">
                            <p><strong>Cargos:</strong> {election.positions.length}</p>
                            <p><strong>Candidatos:</strong> {election.candidates.length}</p>
                            <p><strong>Votantes:</strong> {election.votes.length}</p>
                          </div>

                          <div className="mt-3 rounded-2xl bg-white p-3 text-xs text-slate-600">
                            <div className="mb-1 flex items-center gap-2 font-medium text-slate-800">
                              <Link2 className="h-4 w-4" /> Link exclusivo da turma
                            </div>
                            <code>/votacao/{election.accessCode}</code>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button variant="outline" className="rounded-2xl" onClick={() => toggleElectionStatus(election.id)}>
                              {election.status === "aberta" ? "Encerrar" : "Reabrir"}
                            </Button>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" className="rounded-2xl">Ver candidatos</Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl rounded-3xl">
                                <DialogHeader>
                                  <DialogTitle>{election.className}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3">
                                  {election.candidates.length === 0 && (
                                    <p className="text-sm text-slate-500">Nenhum candidato cadastrado.</p>
                                  )}
                                  {election.candidates.map((candidate) => (
                                    <div key={candidate.id} className="flex items-center justify-between rounded-2xl border p-3">
                                      <div className="flex items-center gap-3">
                                        {candidate.photo ? (
                                          <img src={candidate.photo} alt={candidate.name} className="h-14 w-14 rounded-full object-cover" />
                                        ) : (
                                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                                            <ImagePlus className="h-5 w-5 text-slate-400" />
                                          </div>
                                        )}
                                        <div>
                                          <p className="font-medium">{candidate.name}</p>
                                          <p className="text-sm text-slate-500">{candidate.position} • Nº {candidate.number}</p>
                                        </div>
                                      </div>
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        className="rounded-xl"
                                        onClick={() => removeCandidate(election.id, candidate.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Button
                              variant="destructive"
                              className="rounded-2xl"
                              onClick={() => removeElection(election.id)}
                            >
                              Excluir
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="results" className="mt-6">
                <div className="grid gap-6">
                  {elections.map((election) => {
                    const groupedResults = getElectionResults(election);
                    return (
                      <Card key={election.id} className="rounded-3xl shadow-md">
                        <CardHeader>
                          <div className="flex items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2 text-xl">
                              <BarChart3 className="h-5 w-5" /> {election.className}
                            </CardTitle>
                            <Badge variant={election.status === "aberta" ? "default" : "secondary"}>
                              {election.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                            <p><strong>Escola:</strong> {election.schoolName}</p>
                            <p><strong>Votantes:</strong> {election.votes.length}</p>
                            <p><strong>Link da turma:</strong> /votacao/{election.accessCode}</p>
                          </div>

                          {groupedResults.map((group) => (
                            <div key={group.position} className="space-y-3 rounded-3xl border p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-lg font-semibold">{group.position}</p>
                                  <p className="text-sm text-slate-500">Total de votos para o cargo: {group.totalVotesForPosition}</p>
                                </div>
                                <Badge variant="outline" className="rounded-xl">
                                  {group.ranked[0] ? `Lidera: ${group.ranked[0].name}` : "Sem candidatos"}
                                </Badge>
                              </div>

                              {group.ranked.length === 0 ? (
                                <p className="text-sm text-slate-500">Nenhum candidato cadastrado para este cargo.</p>
                              ) : (
                                group.ranked.map((candidate) => (
                                  <div key={candidate.id} className="rounded-2xl border p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-3">
                                        {candidate.photo ? (
                                          <img src={candidate.photo} alt={candidate.name} className="h-12 w-12 rounded-full object-cover" />
                                        ) : (
                                          <div className="h-12 w-12 rounded-full bg-slate-100" />
                                        )}
                                        <div>
                                          <p className="font-semibold">{candidate.name}</p>
                                          <p className="text-sm text-slate-500">Nº {candidate.number}</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-semibold">{candidate.votes} voto(s)</p>
                                        <p className="text-sm text-slate-500">{candidate.percent}%</p>
                                      </div>
                                    </div>
                                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className="h-full rounded-full bg-slate-900 transition-all"
                                        style={{ width: `${candidate.percent}%` }}
                                      />
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          )
        ) : (
          <Card className="mx-auto max-w-5xl rounded-3xl shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Vote className="h-5 w-5" /> Votação exclusiva por turma
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label>Código ou link da turma</Label>
                  <Input
                    value={accessCodeInput}
                    onChange={(e) => setAccessCodeInput(e.target.value.replace("/votacao/", ""))}
                    placeholder="Ex.: 1anoa-rodolfo-queiroz"
                  />
                </div>
                <div className="flex items-end">
                  <Button className="w-full rounded-2xl" onClick={accessElectionByCode}>
                    Acessar turma
                  </Button>
                </div>
              </div>

              {authenticatedElection && (
                <div className="rounded-3xl border bg-slate-50 p-4">
                  <p className="text-lg font-semibold">{authenticatedElection.className}</p>
                  <p className="text-sm text-slate-600">{authenticatedElection.schoolName}</p>
                  <p className="mt-1 text-sm text-slate-500">{authenticatedElection.description || "Escolha um único candidato para cada cargo."}</p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                    placeholder="Digite seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    value={voterCPF}
                    onChange={(e) => setVoterCPF(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              {!authenticatedElection ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                  Informe o código da turma para liberar a votação.
                </div>
              ) : (
                <div className="space-y-6">
                  {authenticatedElection.positions.map((position) => {
                    const positionCandidates = authenticatedElection.candidates.filter((candidate) => candidate.position === position);
                    return (
                      <div key={position} className="space-y-3 rounded-3xl border p-4">
                        <div>
                          <p className="text-lg font-semibold">{position}</p>
                          <p className="text-sm text-slate-500">Selecione um e somente um candidato para este cargo.</p>
                        </div>

                        {positionCandidates.length === 0 ? (
                          <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                            Nenhum candidato cadastrado para este cargo.
                          </div>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {positionCandidates.map((candidate) => {
                              const active = selectedVotes[position] === candidate.id;
                              return (
                                <button
                                  key={candidate.id}
                                  type="button"
                                  onClick={() => setSelectedVotes((prev) => ({ ...prev, [position]: candidate.id }))}
                                  className={`rounded-3xl border p-4 text-left transition ${
                                    active
                                      ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                                      : "bg-white hover:border-slate-400"
                                  }`}
                                >
                                  <div className="mb-3 flex items-center gap-3">
                                    {candidate.photo ? (
                                      <img src={candidate.photo} alt={candidate.name} className="h-16 w-16 rounded-full object-cover" />
                                    ) : (
                                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                                        <Users className="h-6 w-6 text-slate-400" />
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-base font-semibold">{candidate.name}</p>
                                      <p className={`text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>
                                        Nº {candidate.number}
                                      </p>
                                    </div>
                                  </div>
                                  {active && <Badge className="rounded-xl bg-white text-slate-900">Selecionado</Badge>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <Button className="w-full rounded-2xl text-base" onClick={submitVote}>
                    Confirmar votação da turma
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between text-slate-200">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default App;
