import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_POSITIONS = [
  'Líder',
  'Vice-líder',
  'Representante Indígena',
  'Representante LGBTQIA+',
  'Representante de Segmento',
];

const STORAGE_KEY = 'cerq-eleicao-lideres-local';
const ADMIN_PASSWORD = 'admin123';

const uid = () => Math.random().toString(36).slice(2, 10);
const cleanCPF = (cpf) => cpf.replace(/\D/g, '');

const formatCPF = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const initialData = {
  elections: [
    {
      id: uid(),
      schoolName: 'Colégio Estadual Rodolfo de Queiroz',
      className: '1º Ano A',
      title: 'Eleição da Turma 1º Ano A',
      description: 'Escolha da representação estudantil da turma.',
      status: 'aberta',
      accessCode: '1anoa-rodolfo-queiroz',
      positions: DEFAULT_POSITIONS,
      candidates: [
        { id: uid(), name: 'Ana Clara', position: 'Líder', number: '10', photo: '' },
        { id: uid(), name: 'João Pedro', position: 'Vice-líder', number: '20', photo: '' },
      ],
      votes: [],
    },
  ],
};

export default function App() {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialData;
  });
  const [message, setMessage] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');

  const [adminSchoolName, setAdminSchoolName] = useState('Colégio Estadual Rodolfo de Queiroz');
  const [adminClassName, setAdminClassName] = useState('');
  const [adminTitle, setAdminTitle] = useState('');
  const [adminDescription, setAdminDescription] = useState('');
  const [adminPositions, setAdminPositions] = useState(DEFAULT_POSITIONS.join(', '));
  const [selectedElectionId, setSelectedElectionId] = useState(data.elections[0]?.id || '');
  const [candidateName, setCandidateName] = useState('');
  const [candidatePosition, setCandidatePosition] = useState('');
  const [candidateNumber, setCandidateNumber] = useState('');
  const [candidatePhoto, setCandidatePhoto] = useState('');

  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [authenticatedElectionId, setAuthenticatedElectionId] = useState('');
  const [voterName, setVoterName] = useState('');
  const [voterCPF, setVoterCPF] = useState('');
  const [selectedVotes, setSelectedVotes] = useState({});

  const elections = data.elections;
  const selectedAdminElection = useMemo(
    () => elections.find((e) => e.id === selectedElectionId),
    [elections, selectedElectionId]
  );
  const authenticatedElection = useMemo(
    () => elections.find((e) => e.id === authenticatedElectionId),
    [elections, authenticatedElectionId]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    const syncRoute = () => {
      const path = window.location.pathname || '/';
      setCurrentPath(path);
      const parts = path.split('/').filter(Boolean);
      if (parts[0] === 'votacao' && parts[1]) {
        const election = data.elections.find((e) => e.accessCode === parts[1]);
        if (election) {
          setAuthenticatedElectionId(election.id);
          setAccessCodeInput(election.accessCode);
        }
      }
    };
    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [data.elections]);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const isVotingPage = currentPath.startsWith('/votacao/');

  const addElection = () => {
    if (!adminClassName.trim()) {
      setMessage('Informe a turma para criar a eleição.');
      return;
    }
    const positions = adminPositions.split(',').map((i) => i.trim()).filter(Boolean);
    if (!positions.length) {
      setMessage('Cadastre pelo menos um cargo.');
      return;
    }
    const classLabel = adminClassName.trim();
    const accessCode = `${slugify(classLabel)}-${uid().slice(0, 4)}`;
    const election = {
      id: uid(),
      schoolName: adminSchoolName.trim() || 'Colégio Estadual Rodolfo de Queiroz',
      className: classLabel,
      title: adminTitle.trim() || `Eleição da Turma ${classLabel}`,
      description: adminDescription.trim(),
      status: 'aberta',
      accessCode,
      positions,
      candidates: [],
      votes: [],
    };
    setData((prev) => ({ ...prev, elections: [...prev.elections, election] }));
    setSelectedElectionId(election.id);
    setAdminClassName('');
    setAdminTitle('');
    setAdminDescription('');
    setAdminPositions(DEFAULT_POSITIONS.join(', '));
    setMessage(`Turma criada. Link: /votacao/${accessCode}`);
  };

  const toggleElectionStatus = (electionId) => {
    setData((prev) => ({
      ...prev,
      elections: prev.elections.map((e) =>
        e.id === electionId ? { ...e, status: e.status === 'aberta' ? 'encerrada' : 'aberta' } : e
      ),
    }));
  };

  const removeElection = (electionId) => {
    setData((prev) => ({ ...prev, elections: prev.elections.filter((e) => e.id !== electionId) }));
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCandidatePhoto(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const addCandidate = () => {
    if (!selectedAdminElection || !candidateName.trim() || !candidatePosition.trim()) {
      setMessage('Informe nome e cargo do candidato.');
      return;
    }
    const candidate = {
      id: uid(),
      name: candidateName.trim(),
      position: candidatePosition,
      number: candidateNumber.trim() || String(selectedAdminElection.candidates.length + 1),
      photo: candidatePhoto,
    };
    setData((prev) => ({
      ...prev,
      elections: prev.elections.map((e) =>
        e.id === selectedAdminElection.id ? { ...e, candidates: [...e.candidates, candidate] } : e
      ),
    }));
    setCandidateName('');
    setCandidatePosition('');
    setCandidateNumber('');
    setCandidatePhoto('');
    setMessage('Candidato cadastrado com sucesso.');
  };

  const removeCandidate = (electionId, candidateId) => {
    setData((prev) => ({
      ...prev,
      elections: prev.elections.map((e) =>
        e.id === electionId ? { ...e, candidates: e.candidates.filter((c) => c.id !== candidateId) } : e
      ),
    }));
  };

  const accessElectionByCode = () => {
    const code = accessCodeInput.trim().replace('/votacao/', '');
    const election = elections.find((e) => e.accessCode === code);
    if (!election) {
      setMessage('Turma não encontrada.');
      return;
    }
    setAuthenticatedElectionId(election.id);
    setSelectedVotes({});
    navigateTo(`/votacao/${election.accessCode}`);
  };

  const submitVote = () => {
    const cpf = cleanCPF(voterCPF);
    if (!voterName.trim() || cpf.length !== 11 || !authenticatedElection) {
      setMessage('Preencha nome, CPF e acesse a turma.');
      return;
    }
    if (authenticatedElection.status !== 'aberta') {
      setMessage('Esta eleição está encerrada.');
      return;
    }
    const missing = authenticatedElection.positions.filter((position) => !selectedVotes[position]);
    if (missing.length) {
      setMessage('Escolha um único candidato para cada cargo.');
      return;
    }
    const alreadyVoted = authenticatedElection.votes.some((v) => v.cpf === cpf);
    if (alreadyVoted) {
      setMessage('Este CPF já votou nesta turma.');
      return;
    }
    const choices = authenticatedElection.positions.map((position) => ({
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
                { id: uid(), voterName: voterName.trim(), cpf, choices, createdAt: new Date().toISOString() },
              ],
            }
          : e
      ),
    }));
    setVoterName('');
    setVoterCPF('');
    setSelectedVotes({});
    setMessage('Votação registrada com sucesso.');
  };

  const getElectionResults = (election) => {
    return election.positions.map((position) => {
      const ranked = election.candidates
        .filter((c) => c.position === position)
        .map((candidate) => {
          const votes = election.votes.filter((vote) =>
            vote.choices.some((choice) => choice.position === position && choice.candidateId === candidate.id)
          ).length;
          const percent = election.votes.length ? ((votes / election.votes.length) * 100).toFixed(1) : '0.0';
          return { ...candidate, votes, percent };
        })
        .sort((a, b) => b.votes - a.votes);
      return { position, ranked };
    });
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      navigateTo('/admin');
      setMessage('Acesso liberado.');
    } else {
      setMessage('Senha incorreta.');
    }
  };

  const handleLogout = () => {
    setIsAdminAuthenticated(false);
    setAdminPassword('');
    navigateTo('/');
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <h1>Sistema de Eleição de Líderes</h1>
          <p>Colégio Estadual Rodolfo de Queiroz</p>
        </div>
        <div className="stats">
          <div className="stat"><strong>{elections.length}</strong><span>Turmas</span></div>
          <div className="stat"><strong>{elections.reduce((a, e) => a + e.candidates.length, 0)}</strong><span>Candidatos</span></div>
          <div className="stat"><strong>{elections.reduce((a, e) => a + e.votes.length, 0)}</strong><span>Votantes</span></div>
        </div>
      </header>

      {message && <div className="message">{message}</div>}

      {!isVotingPage ? (
        !isAdminAuthenticated ? (
          <section className="card login-card">
            <h2>Acesso do administrador</h2>
            <p>Somente a administração acessa cadastro de candidatos, turmas e apuração.</p>
            <label>Senha do administrador</label>
            <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={handleAdminLogin}>Entrar</button>
            <small>Senha de demonstração: admin123</small>
          </section>
        ) : (
          <>
            <div className="top-actions"><button className="secondary" onClick={handleLogout}>Sair da administração</button></div>
            <div className="grid two">
              <section className="card">
                <h2>Nova eleição por turma</h2>
                <label>Nome da escola</label>
                <input value={adminSchoolName} onChange={(e) => setAdminSchoolName(e.target.value)} />
                <label>Turma</label>
                <input value={adminClassName} onChange={(e) => setAdminClassName(e.target.value)} placeholder="Ex.: 2º Ano B" />
                <label>Título da eleição</label>
                <input value={adminTitle} onChange={(e) => setAdminTitle(e.target.value)} placeholder="Ex.: Eleição da turma" />
                <label>Descrição</label>
                <input value={adminDescription} onChange={(e) => setAdminDescription(e.target.value)} placeholder="Descreva a votação" />
                <label>Cargos</label>
                <input value={adminPositions} onChange={(e) => setAdminPositions(e.target.value)} placeholder="Líder, Vice-líder, ..." />
                <button onClick={addElection}>Cadastrar eleição</button>
              </section>

              <section className="card">
                <h2>Cadastrar candidato</h2>
                <label>Turma</label>
                <select value={selectedElectionId} onChange={(e) => setSelectedElectionId(e.target.value)}>
                  {elections.map((e) => <option key={e.id} value={e.id}>{e.className}</option>)}
                </select>
                <label>Nome do candidato</label>
                <input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
                <label>Cargo</label>
                <select value={candidatePosition} onChange={(e) => setCandidatePosition(e.target.value)}>
                  <option value="">Selecione</option>
                  {(selectedAdminElection?.positions || []).map((position) => (
                    <option key={position} value={position}>{position}</option>
                  ))}
                </select>
                <label>Número</label>
                <input value={candidateNumber} onChange={(e) => setCandidateNumber(e.target.value)} />
                <label>Foto do candidato</label>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} />
                {candidatePhoto && <img className="thumb" src={candidatePhoto} alt="prévia" />}
                <button onClick={addCandidate}>Adicionar candidato</button>
              </section>
            </div>

            <section className="card">
              <h2>Painel das turmas</h2>
              <div className="grid three">
                {elections.map((election) => (
                  <article key={election.id} className="panel-item">
                    <div className="row space-between">
                      <div>
                        <h3>{election.className}</h3>
                        <p>{election.title}</p>
                      </div>
                      <span className={`badge ${election.status}`}>{election.status}</span>
                    </div>
                    <p><strong>Cargos:</strong> {election.positions.length}</p>
                    <p><strong>Candidatos:</strong> {election.candidates.length}</p>
                    <p><strong>Votantes:</strong> {election.votes.length}</p>
                    <div className="link-box">/votacao/{election.accessCode}</div>
                    <div className="actions-wrap">
                      <button className="secondary" onClick={() => toggleElectionStatus(election.id)}>{election.status === 'aberta' ? 'Encerrar' : 'Reabrir'}</button>
                      <button className="danger" onClick={() => removeElection(election.id)}>Excluir turma</button>
                    </div>
                    <div className="candidate-list compact">
                      {election.candidates.map((candidate) => (
                        <div key={candidate.id} className="candidate-row">
                          <div className="row gap">
                            {candidate.photo ? <img className="avatar" src={candidate.photo} alt={candidate.name} /> : <div className="avatar placeholder" />}
                            <div>
                              <strong>{candidate.name}</strong>
                              <p>{candidate.position} · Nº {candidate.number}</p>
                            </div>
                          </div>
                          <button className="danger small" onClick={() => removeCandidate(election.id, candidate.id)}>Excluir</button>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="card">
              <h2>Apuração</h2>
              {elections.map((election) => (
                <div key={election.id} className="result-block">
                  <h3>{election.className}</h3>
                  <p>
  <strong>Link:</strong>{" "}
  <a
    href={`${window.location.origin}/votacao/${election.accessCode}`}
    target="_blank"
    rel="noreferrer"
  >
    {`${window.location.origin}/votacao/${election.accessCode}`}
  </a>
</p>
                  {getElectionResults(election).map((group) => (
                    <div key={group.position} className="group-block">
                      <h4>{group.position}</h4>
                      {group.ranked.length === 0 ? <p>Sem candidatos.</p> : group.ranked.map((candidate) => (
                        <div className="result-row" key={candidate.id}>
                          <span>{candidate.name}</span>
                          <span>{candidate.votes} voto(s) · {candidate.percent}%</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          </>
        )
      ) : (
        <section className="card">
          <h2>Votação da turma</h2>
          <label>Código ou link da turma</label>
          <div className="row gap">
            <input value={accessCodeInput} onChange={(e) => setAccessCodeInput(e.target.value.replace('/votacao/', ''))} />
            <button onClick={accessElectionByCode}>Acessar</button>
          </div>

          {authenticatedElection && (
            <div className="highlight-box">
              <h3>{authenticatedElection.className}</h3>
              <p>{authenticatedElection.description || 'Escolha um único candidato para cada cargo.'}</p>
            </div>
          )}

          <div className="grid two">
            <div>
              <label>Nome completo</label>
              <input value={voterName} onChange={(e) => setVoterName(e.target.value)} />
            </div>
            <div>
              <label>CPF</label>
              <input value={voterCPF} onChange={(e) => setVoterCPF(formatCPF(e.target.value))} />
            </div>
          </div>

          {authenticatedElection && authenticatedElection.positions.map((position) => {
            const positionCandidates = authenticatedElection.candidates.filter((c) => c.position === position);
            return (
              <div key={position} className="position-block">
                <h3>{position}</h3>
                <p>Selecione um único candidato.</p>
                <div className="grid three">
                  {positionCandidates.map((candidate) => {
                    const active = selectedVotes[position] === candidate.id;
                    return (
                      <button key={candidate.id} className={`candidate-card ${active ? 'selected' : ''}`} onClick={() => setSelectedVotes((prev) => ({ ...prev, [position]: candidate.id }))}>
                        {candidate.photo ? <img className="avatar big" src={candidate.photo} alt={candidate.name} /> : <div className="avatar big placeholder" />}
                        <strong>{candidate.name}</strong>
                        <span>Nº {candidate.number}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <button onClick={submitVote}>Confirmar votação</button>
        </section>
      )}
    </div>
  );
}
