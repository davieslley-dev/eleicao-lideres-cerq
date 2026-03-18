import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEFAULT_POSITIONS = [
  'Líder',
  'Vice-líder',
  'Representante Indígena',
  'Representante LGBTQIA+',
  'Representante de Segmento',
];

const ADMIN_USERNAME = 'CERQ';
const ADMIN_PASSWORD = '1234';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function cleanCPF(cpf) {
  return cpf.replace(/\D/g, '');
}

function formatCPF(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function groupElectionData(elections, positions, candidates, voters, votes) {
  return elections.map((election) => {
    const electionPositions = positions
      .filter((position) => position.election_id === election.id)
      .map((position) => ({ id: position.id, name: position.name }));

    const electionCandidates = candidates
      .filter((candidate) => candidate.election_id === election.id)
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        number: candidate.number || '',
        photo: candidate.photo_url || '',
        positionId: candidate.position_id,
        position:
          electionPositions.find((position) => position.id === candidate.position_id)?.name || '',
      }));

    const electionVoters = voters.filter((voter) => voter.election_id === election.id);
    const electionVotes = votes.filter((vote) => vote.election_id === election.id);

    const mappedVotes = electionVoters.map((voter) => ({
      id: voter.id,
      voterName: voter.voter_name,
      cpf: voter.cpf,
      choices: electionVotes
        .filter((vote) => vote.voter_id === voter.id)
        .map((vote) => ({
          positionId: vote.position_id,
          position:
            electionPositions.find((position) => position.id === vote.position_id)?.name || '',
          candidateId: vote.candidate_id,
        })),
    }));

    return {
      id: election.id,
      schoolName: election.school_name,
      className: election.class_name,
      title: election.title,
      description: election.description || '',
      status: election.status,
      accessCode: election.access_code,
      positions: electionPositions,
      candidates: electionCandidates,
      votes: mappedVotes,
    };
  });
}

export default function App() {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [adminUsername, setAdminUsername] = useState('CERQ');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const [className, setClassName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [positionsText, setPositionsText] = useState(DEFAULT_POSITIONS.join(', '));

  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [candidatePositionId, setCandidatePositionId] = useState('');
  const [candidateNumber, setCandidateNumber] = useState('');
  const [candidatePhoto, setCandidatePhoto] = useState('');

  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [currentElectionId, setCurrentElectionId] = useState('');
  const [voterName, setVoterName] = useState('');
  const [voterCPF, setVoterCPF] = useState('');
  const [selectedVotes, setSelectedVotes] = useState({});

  const isVotingPage = window.location.pathname.startsWith('/votacao/');

  const selectedElection = useMemo(
    () => elections.find((election) => election.id === selectedElectionId),
    [elections, selectedElectionId]
  );

  const currentElection = useMemo(
    () => elections.find((election) => election.id === currentElectionId),
    [elections, currentElectionId]
  );

  async function loadData() {
    setLoading(true);
    const [{ data: electionsData, error: electionsError }, { data: positionsData, error: positionsError }, { data: candidatesData, error: candidatesError }, { data: votersData, error: votersError }, { data: votesData, error: votesError }] = await Promise.all([
      supabase.from('elections').select('*').order('created_at', { ascending: true }),
      supabase.from('positions').select('*').order('created_at', { ascending: true }),
      supabase.from('candidates').select('*').order('created_at', { ascending: true }),
      supabase.from('voters').select('*').order('created_at', { ascending: true }),
      supabase.from('votes').select('*').order('created_at', { ascending: true }),
    ]);

    const firstError = electionsError || positionsError || candidatesError || votersError || votesError;

    if (firstError) {
      setMessage(`Erro ao carregar dados: ${firstError.message}`);
      setLoading(false);
      return;
    }

    const grouped = groupElectionData(
      electionsData || [],
      positionsData || [],
      candidatesData || [],
      votersData || [],
      votesData || []
    );

    setElections(grouped);
    setSelectedElectionId((current) => current || grouped[0]?.id || '');

    const path = window.location.pathname;
    if (path.startsWith('/votacao/')) {
      const code = path.replace('/votacao/', '').trim();
      const election = grouped.find((item) => item.accessCode === code);
      if (election) {
        setCurrentElectionId(election.id);
        setAccessCodeInput(code);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createElection() {
    if (!className.trim()) {
      setMessage('Informe a turma.');
      return;
    }

    const positions = positionsText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (positions.length === 0) {
      setMessage('Informe ao menos um cargo.');
      return;
    }

    const accessCode = `${slugify(className)}-${uid().slice(0, 4)}`;

    const { data: createdElection, error: electionError } = await supabase
      .from('elections')
      .insert({
        school_name: 'Colégio Estadual Rodolfo de Queiroz',
        class_name: className.trim(),
        title: title.trim() || `Eleição da Turma ${className.trim()}`,
        description: description.trim(),
        status: 'aberta',
        access_code: accessCode,
      })
      .select()
      .single();

    if (electionError) {
      setMessage(`Erro ao cadastrar eleição: ${electionError.message}`);
      return;
    }

    const { error: positionsError } = await supabase.from('positions').insert(
      positions.map((name) => ({ election_id: createdElection.id, name }))
    );

    if (positionsError) {
      setMessage(`Erro ao cadastrar cargos: ${positionsError.message}`);
      return;
    }

    setClassName('');
    setTitle('');
    setDescription('');
    setPositionsText(DEFAULT_POSITIONS.join(', '));
    setMessage('Turma criada com sucesso.');
    await loadData();
  }

  function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCandidatePhoto(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  async function addCandidate() {
    if (!selectedElectionId || !candidateName.trim() || !candidatePositionId) {
      setMessage('Selecione a turma, o cargo e o nome do candidato.');
      return;
    }

    const { error } = await supabase.from('candidates').insert({
      election_id: selectedElectionId,
      position_id: candidatePositionId,
      name: candidateName.trim(),
      number: candidateNumber.trim(),
      photo_url: candidatePhoto,
    });

    if (error) {
      setMessage(`Erro ao cadastrar candidato: ${error.message}`);
      return;
    }

    setCandidateName('');
    setCandidatePositionId('');
    setCandidateNumber('');
    setCandidatePhoto('');
    setMessage('Candidato cadastrado com sucesso.');
    await loadData();
  }

  async function deleteCandidate(candidateId) {
    const { error } = await supabase.from('candidates').delete().eq('id', candidateId);
    if (error) {
      setMessage(`Erro ao excluir candidato: ${error.message}`);
      return;
    }
    setMessage('Candidato excluído com sucesso.');
    await loadData();
  }

  async function deleteElection(electionId) {
    const { error } = await supabase.from('elections').delete().eq('id', electionId);
    if (error) {
      setMessage(`Erro ao excluir turma: ${error.message}`);
      return;
    }
    setMessage('Turma excluída com sucesso.');
    await loadData();
  }

  async function toggleElectionStatus(election) {
    const { error } = await supabase
      .from('elections')
      .update({ status: election.status === 'aberta' ? 'encerrada' : 'aberta' })
      .eq('id', election.id);

    if (error) {
      setMessage(`Erro ao atualizar status: ${error.message}`);
      return;
    }

    setMessage('Status atualizado com sucesso.');
    await loadData();
  }

  function accessElectionByCode() {
    const code = accessCodeInput.replace('/votacao/', '').trim();
    if (!code) {
      setMessage('Informe o código da turma.');
      return;
    }
    window.location.href = `${window.location.origin}/votacao/${code}`;
  }

  async function submitVote() {
    if (!currentElection) {
      setMessage('Turma não encontrada.');
      return;
    }

    const cpf = cleanCPF(voterCPF);
    if (!voterName.trim() || cpf.length !== 11) {
      setMessage('Preencha nome e CPF corretamente.');
      return;
    }

    if (currentElection.status !== 'aberta') {
      setMessage('Esta eleição está encerrada.');
      return;
    }

    const positionsWithCandidates = currentElection.positions.filter((position) =>
      currentElection.candidates.some((candidate) => candidate.positionId === position.id)
    );

    if (positionsWithCandidates.length === 0) {
      setMessage('Esta turma ainda não possui candidatos cadastrados.');
      return;
    }

    const missingPositions = positionsWithCandidates.filter((position) => !selectedVotes[position.id]);
    if (missingPositions.length > 0) {
      setMessage('Escolha um candidato para cada cargo disponível.');
      return;
    }

    const { data: existingVoter } = await supabase
      .from('voters')
      .select('id')
      .eq('election_id', currentElection.id)
      .eq('cpf', cpf)
      .maybeSingle();

    if (existingVoter) {
      setMessage('Este CPF já votou nesta turma.');
      return;
    }

    const { data: createdVoter, error: voterError } = await supabase
      .from('voters')
      .insert({
        election_id: currentElection.id,
        voter_name: voterName.trim(),
        cpf,
      })
      .select()
      .single();

    if (voterError) {
      setMessage(`Erro ao registrar votante: ${voterError.message}`);
      return;
    }

    const { error: votesError } = await supabase.from('votes').insert(
      positionsWithCandidates.map((position) => ({
        election_id: currentElection.id,
        voter_id: createdVoter.id,
        position_id: position.id,
        candidate_id: selectedVotes[position.id],
      }))
    );

    if (votesError) {
      setMessage(`Erro ao registrar votos: ${votesError.message}`);
      return;
    }

    setVoterName('');
    setVoterCPF('');
    setSelectedVotes({});
    setMessage('Voto registrado com sucesso.');
    await loadData();
  }

  function getResultsByPosition(election) {
    return election.positions.map((position) => {
      const candidates = election.candidates.filter((candidate) => candidate.positionId === position.id);
      const totalVotes = election.votes.filter((vote) =>
        vote.choices.some((choice) => choice.positionId === position.id)
      ).length;

      const ranked = candidates
        .map((candidate) => {
          const candidateVotes = election.votes.filter((vote) =>
            vote.choices.some(
              (choice) => choice.positionId === position.id && choice.candidateId === candidate.id
            )
          ).length;

          return {
            ...candidate,
            totalVotes: candidateVotes,
            percent: totalVotes > 0 ? ((candidateVotes / totalVotes) * 100).toFixed(1) : '0.0',
          };
        })
        .sort((a, b) => b.totalVotes - a.totalVotes);

      return { position, ranked };
    });
  }


  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatCpfForReport(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length !== 11) return value || '-';
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{2})$/, '$1-$2');
  }

  function openElectionReport(election) {
    const groupedResults = getResultsByPosition(election);
    const candidateMap = new Map((election.candidates || []).map((candidate) => [candidate.id, candidate]));

    const summaryRows = groupedResults
      .map((group) => {
        if (!group.ranked.length) {
          return `
            <tr>
              <td>${escapeHtml(group.position.name)}</td>
              <td colspan="4">Sem candidatos cadastrados.</td>
            </tr>
          `;
        }

        return group.ranked
          .map(
            (candidate) => `
              <tr>
                <td>${escapeHtml(group.position.name)}</td>
                <td>${escapeHtml(candidate.name || '-')}</td>
                <td>${escapeHtml(candidate.number || '-')}</td>
                <td>${escapeHtml(String(candidate.totalVotes ?? 0))}</td>
                <td>${escapeHtml(String(candidate.percent ?? '0.0'))}%</td>
              </tr>
            `
          )
          .join('');
      })
      .join('');

    const voteRows = (election.votes || [])
      .map((vote) =>
        (vote.choices || [])
          .map((choice) => {
            const candidate = candidateMap.get(choice.candidateId);
            return `
              <tr>
                <td>${escapeHtml(vote.voterName || '-')}</td>
                <td>${escapeHtml(formatCpfForReport(vote.cpf))}</td>
                <td>${escapeHtml(choice.position || '-')}</td>
                <td>${escapeHtml(candidate?.name || 'Não identificado')}</td>
                <td>${escapeHtml(candidate?.number || '-')}</td>
              </tr>
            `;
          })
          .join('')
      )
      .join('');

    const reportWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!reportWindow) {
      setMessage('O navegador bloqueou a nova aba do relatório.');
      return;
    }

    reportWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Relatório da votação - ${escapeHtml(election.className || 'Turma')}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111827; }
          .header { border: 2px solid #0f172a; border-radius: 14px; padding: 20px; margin-bottom: 20px; }
          h1, h2, h3 { margin: 0 0 10px; }
          p { margin: 6px 0; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 12px; margin-top: 14px; }
          .meta-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; }
          .section { margin-top: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 14px; }
          th { background: #e5edf8; }
          .actions { margin-bottom: 20px; }
          .actions button { background: #0f172a; color: #fff; border: none; border-radius: 10px; padding: 10px 16px; cursor: pointer; }
          .badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; }
          .footer { margin-top: 28px; font-size: 13px; color: #475569; }
          @media print { .actions { display: none; } body { margin: 10mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Boletim completo da votação</h1>
          <p><strong>Escola:</strong> ${escapeHtml(election.schoolName || 'Colégio Estadual Rodolfo de Queiroz')}</p>
          <p><strong>Turma:</strong> ${escapeHtml(election.className || '-')}</p>
          <p><strong>Eleição:</strong> ${escapeHtml(election.title || '-')}</p>
          <p><strong>Status:</strong> <span class="badge">${escapeHtml((election.status || '').toUpperCase())}</span></p>
          <div class="meta">
            <div class="meta-card"><strong>Total de votantes:</strong><br />${escapeHtml(String((election.votes || []).length))}</div>
            <div class="meta-card"><strong>Link da turma:</strong><br />${escapeHtml(`${window.location.origin}/votacao/${election.accessCode}`)}</div>
          </div>
        </div>

        <div class="actions">
          <button onclick="window.print()">Imprimir / Salvar em PDF</button>
        </div>

        <div class="section">
          <h2>Apuração</h2>
          <table>
            <thead>
              <tr>
                <th>Cargo</th>
                <th>Candidato</th>
                <th>Número</th>
                <th>Votos</th>
                <th>Percentual</th>
              </tr>
            </thead>
            <tbody>
              ${summaryRows || '<tr><td colspan="5">Sem dados de apuração.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Registro nominal dos votos</h2>
          <table>
            <thead>
              <tr>
                <th>Eleitor</th>
                <th>CPF</th>
                <th>Cargo</th>
                <th>Candidato escolhido</th>
                <th>Número</th>
              </tr>
            </thead>
            <tbody>
              ${voteRows || '<tr><td colspan="5">Nenhum voto registrado.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="footer">
          Relatório gerado automaticamente para conferência, lisura e auditoria da votação.
        </div>
      </body>
      </html>
    `);
    reportWindow.document.close();
  }

  if (loading) {
    return <div style={styles.loading}>Carregando...</div>;
  }

  if (isVotingPage) {
    return (
      <div style={styles.page}>
        <div style={styles.banner}>
          <div>
            <h1 style={styles.bannerTitle}>Sistema de Eleição de Líderes</h1>
            <p style={styles.bannerSubtitle}>Colégio Estadual Rodolfo de Queiroz</p>
          </div>
        </div>

        {message ? <div style={styles.alert}>{message}</div> : null}

        <div style={styles.cardLarge}>
          <h2 style={styles.title}>Votação da turma</h2>

          <div style={styles.field}>
            <label style={styles.label}>Código ou link da turma</label>
            <input
              style={styles.input}
              value={accessCodeInput}
              onChange={(e) => setAccessCodeInput(e.target.value)}
              placeholder="Digite o código da turma"
            />
          </div>

          <button style={styles.primaryButton} onClick={accessElectionByCode}>
            Acessar turma
          </button>

          {currentElection ? (
            <>
              <div style={{ marginTop: 20 }}>
                <h3 style={{ marginBottom: 8 }}>{currentElection.className}</h3>
                <p style={{ color: '#555' }}>
                  {currentElection.description || 'Escolha um candidato para cada cargo disponível.'}
                </p>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Nome completo</label>
                <input style={styles.input} value={voterName} onChange={(e) => setVoterName(e.target.value)} />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>CPF</label>
                <input
                  style={styles.input}
                  value={voterCPF}
                  onChange={(e) => setVoterCPF(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>

              {currentElection.positions
                .filter((position) => currentElection.candidates.some((candidate) => candidate.positionId === position.id))
                .map((position) => {
                  const positionCandidates = currentElection.candidates.filter(
                    (candidate) => candidate.positionId === position.id
                  );

                  return (
                    <div key={position.id} style={styles.positionBox}>
                      <h3 style={{ marginBottom: 6 }}>{position.name}</h3>
                      <p style={{ color: '#666', marginBottom: 12 }}>Selecione um e somente um candidato.</p>

                      <div style={styles.candidateGrid}>
                        {positionCandidates.map((candidate) => {
                          const active = selectedVotes[position.id] === candidate.id;
                          return (
                            <button
                              key={candidate.id}
                              onClick={() =>
                                setSelectedVotes((prev) => ({
                                  ...prev,
                                  [position.id]: candidate.id,
                                }))
                              }
                              style={{
                                ...styles.candidateButton,
                                ...(active ? styles.candidateButtonActive : {}),
                              }}
                            >
                              <div style={styles.candidateInfo}>
                                {candidate.photo ? (
                                  <img src={candidate.photo} alt={candidate.name} style={styles.avatar} />
                                ) : (
                                  <div style={styles.avatarPlaceholder} />
                                )}
                                <div>
                                  <div style={{ ...styles.candidateName, color: active ? '#111827' : styles.candidateName.color }}>{candidate.name}</div>
                                  <div style={{ ...styles.candidateMeta, color: active ? '#1f2937' : styles.candidateMeta.color }}>Nº {candidate.number}</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

              <button style={styles.primaryButton} onClick={submitVote}>
                Confirmar votação
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <div style={styles.page}>
        <div style={styles.banner}>
          <div>
            <h1 style={styles.bannerTitle}>Sistema de Eleição de Líderes</h1>
            <p style={styles.bannerSubtitle}>Colégio Estadual Rodolfo de Queiroz</p>
          </div>
        </div>

        {message ? <div style={styles.alert}>{message}</div> : null}

        <div style={styles.loginCard}>
          <h2 style={styles.title}>Acesso do administrador</h2>
          <p style={styles.text}>Somente a administração acessa cadastro de candidatos, turmas e apuração.</p>

          <div style={styles.field}>
            <label style={styles.label}>Usuário administrador</label>
            <input
              style={styles.input}
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="CERQ"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Senha</label>
            <input
              type="password"
              style={styles.input}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Digite a senha"
            />
          </div>

          <button
            style={styles.primaryButton}
            onClick={() => {
              if (adminUsername.trim() === ADMIN_USERNAME && adminPassword === ADMIN_PASSWORD) {
                setIsAdminAuthenticated(true);
                setMessage('Acesso liberado.');
              } else {
                setMessage('Usuário ou senha inválidos.');
              }
            }}
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.banner}>
        <div>
          <h1 style={styles.bannerTitle}>Sistema de Eleição de Líderes</h1>
          <p style={styles.bannerSubtitle}>Colégio Estadual Rodolfo de Queiroz</p>
        </div>
      </div>

      {message ? <div style={styles.alert}>{message}</div> : null}

      <div style={styles.topBar}>
        <button style={styles.secondaryButton} onClick={() => setIsAdminAuthenticated(false)}>
          Sair
        </button>
      </div>

      <div style={styles.grid2}>
        <div style={styles.card}>
          <h2 style={styles.title}>Nova eleição por turma</h2>

          <div style={styles.field}>
            <label style={styles.label}>Turma</label>
            <input style={styles.input} value={className} onChange={(e) => setClassName(e.target.value)} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Título da eleição</label>
            <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Descrição</label>
            <input style={styles.input} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Cargos</label>
            <input style={styles.input} value={positionsText} onChange={(e) => setPositionsText(e.target.value)} />
          </div>

          <button style={styles.primaryButton} onClick={createElection}>
            Cadastrar eleição
          </button>
        </div>

        <div style={styles.card}>
          <h2 style={styles.title}>Cadastrar candidato</h2>

          <div style={styles.field}>
            <label style={styles.label}>Selecione a turma</label>
            <select
              style={styles.input}
              value={selectedElectionId}
              onChange={(e) => {
                setSelectedElectionId(e.target.value);
                setCandidatePositionId('');
              }}
            >
              <option value="">Selecione</option>
              {elections.map((election) => (
                <option key={election.id} value={election.id}>
                  {election.className}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Nome do candidato</label>
            <input style={styles.input} value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Cargo disputado</label>
            <select
              style={styles.input}
              value={candidatePositionId}
              onChange={(e) => setCandidatePositionId(e.target.value)}
            >
              <option value="">Selecione</option>
              {(selectedElection?.positions || []).map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Número do candidato</label>
            <input style={styles.input} value={candidateNumber} onChange={(e) => setCandidateNumber(e.target.value)} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Foto do candidato</label>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} />
          </div>

          <button style={styles.primaryButton} onClick={addCandidate}>
            Adicionar candidato
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.title}>Painel das turmas</h2>

        <div style={styles.panelGrid}>
          {elections.map((election) => (
            <div key={election.id} style={styles.panelCard}>
              <div style={styles.panelHeader}>
                <div>
                  <h3 style={{ margin: 0 }}>{election.className}</h3>
                  <p style={{ marginTop: 8 }}>{election.title}</p>
                </div>
                <span style={styles.statusBadge}>
                  {election.status === 'aberta' ? 'ABERTA' : 'ENCERRADA'}
                </span>
              </div>

              <p><strong>Cargos:</strong> {election.positions.length}</p>
              <p><strong>Candidatos:</strong> {election.candidates.length}</p>
              <p><strong>Votantes:</strong> {election.votes.length}</p>

              <div style={styles.linkBox}>{`${window.location.origin}/votacao/${election.accessCode}`}</div>

              <div style={styles.buttonRow}>
                <button style={styles.secondaryButton} onClick={() => toggleElectionStatus(election)}>
                  {election.status === 'aberta' ? 'Encerrar' : 'Reabrir'}
                </button>

                <button style={styles.dangerButton} onClick={() => deleteElection(election.id)}>
                  Excluir turma
                </button>
              </div>

              <div style={{ marginTop: 20 }}>
                {election.candidates.map((candidate) => (
                  <div key={candidate.id} style={styles.candidateRow}>
                    <div style={styles.candidateInfo}>
                      {candidate.photo ? (
                        <img src={candidate.photo} alt={candidate.name} style={styles.avatarSmall} />
                      ) : (
                        <div style={styles.avatarPlaceholderSmall} />
                      )}
                      <div>
                        <div style={styles.candidateName}>{candidate.name}</div>
                        <div style={styles.candidateMeta}>
                          {candidate.position} · Nº {candidate.number}
                        </div>
                      </div>
                    </div>

                    <button style={styles.dangerButtonSmall} onClick={() => deleteCandidate(candidate.id)}>
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.title}>Apuração</h2>

        {elections.map((election) => (
          <div key={election.id} style={{ marginBottom: 30 }}>
            <div style={styles.reportHeader}>
              <div>
                <h3 style={{ marginBottom: 8 }}>{election.className}</h3>
                <p>
                  <strong>Link:</strong> {`${window.location.origin}/votacao/${election.accessCode}`}
                </p>
              </div>
              <button style={styles.reportButton} onClick={() => openElectionReport(election)}>
                Gerar relatório completo
              </button>
            </div>
            {getResultsByPosition(election).map((group) => (
              <div key={group.position.id} style={styles.groupBlock}>
                <h4>{group.position.name}</h4>
                {group.ranked.length === 0 ? (
                  <p>Sem candidatos.</p>
                ) : (
                  group.ranked.map((candidate) => (
                    <div style={styles.resultRow} key={candidate.id}>
                      <span>{candidate.name}</span>
                      <span>
                        {candidate.totalVotes} voto(s) · {candidate.percent}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial, sans-serif',
    fontSize: 18,
  },
  page: {
    minHeight: '100vh',
    background: '#f3f4f6',
    padding: 20,
    fontFamily: 'Arial, sans-serif',
    color: '#0f172a',
  },
  banner: {
    background: 'linear-gradient(90deg, #0f172a 0%, #334155 100%)',
    borderRadius: 24,
    padding: 28,
    color: 'white',
    marginBottom: 20,
  },
  bannerTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
  },
  bannerSubtitle: {
    marginTop: 10,
    marginBottom: 0,
    fontSize: 16,
  },
  alert: {
    background: 'white',
    border: '1px solid #cbd5e1',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  loginCard: {
    maxWidth: 520,
    background: 'white',
    borderRadius: 24,
    padding: 28,
    margin: '0 auto',
    border: '1px solid #e2e8f0',
  },
  cardLarge: {
    maxWidth: 920,
    background: 'white',
    borderRadius: 24,
    padding: 28,
    margin: '0 auto',
    border: '1px solid #e2e8f0',
  },
  card: {
    background: 'white',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    border: '1px solid #e2e8f0',
  },
  title: {
    marginTop: 0,
    marginBottom: 20,
    fontSize: 22,
  },
  text: {
    marginTop: 0,
    marginBottom: 20,
    lineHeight: 1.5,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    marginBottom: 8,
    fontWeight: 600,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid #cbd5e1',
    fontSize: 16,
    boxSizing: 'border-box',
  },
  primaryButton: {
    background: '#0f172a',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    padding: '12px 18px',
    cursor: 'pointer',
    fontSize: 16,
  },
  secondaryButton: {
    background: '#e2e8f0',
    color: '#0f172a',
    border: 'none',
    borderRadius: 14,
    padding: '12px 18px',
    cursor: 'pointer',
    fontSize: 16,
  },
  dangerButton: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    padding: '12px 18px',
    cursor: 'pointer',
    fontSize: 16,
  },
  dangerButtonSmall: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: 14,
  },
  topBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
    marginBottom: 24,
  },
  panelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
  },
  panelCard: {
    border: '1px solid #dbe3ef',
    borderRadius: 24,
    padding: 20,
    background: '#fafafa',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  statusBadge: {
    background: '#dcfce7',
    color: '#166534',
    borderRadius: 999,
    padding: '10px 14px',
    fontSize: 14,
  },
  linkBox: {
    display: 'block',
    marginTop: 14,
    marginBottom: 16,
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px dashed #94a3b8',
    color: '#0f172a',
    wordBreak: 'break-all',
    textDecoration: 'none',
  },
  buttonRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  candidateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '14px 0',
    borderTop: '1px solid #e5e7eb',
  },
  candidateInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    textAlign: 'left',
  },
  candidateName: {
    fontWeight: 700,
    marginBottom: 6,
  },
  candidateMeta: {
    color: '#334155',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    objectFit: 'cover',
    background: '#e5e7eb',
  },
  avatarSmall: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    objectFit: 'cover',
    background: '#e5e7eb',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#e5e7eb',
  },
  avatarPlaceholderSmall: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#e5e7eb',
  },
  positionBox: {
    marginTop: 20,
    marginBottom: 20,
    border: '1px solid #e2e8f0',
    borderRadius: 20,
    padding: 18,
  },
  candidateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 14,
  },
  candidateButton: {
    border: '1px solid #cbd5e1',
    background: 'white',
    borderRadius: 18,
    padding: 14,
    cursor: 'pointer',
  },
  candidateButtonActive: {
    border: '2px solid #0f172a',
    background: '#e2e8f0',
    color: '#111827',
  },
  reportHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  reportButton: {
    background: '#0f172a',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  },
  groupBlock: {
    marginTop: 16,
    marginBottom: 20,
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    padding: 16,
    background: '#fafafa',
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 0',
    borderTop: '1px solid #e5e7eb',
  },
};
