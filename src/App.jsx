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
const ADMIN_PASSWORD = '123456';

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
  return String(cpf || '').replace(/\D/g, '');
}

function formatCPF(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 11);

  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCpfForReport(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length !== 11) return value || '';
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{2})$/, '$1-$2');
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
      validityStatus: election.validity_status || 'valida',
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

  const [editingElectionId, setEditingElectionId] = useState('');
  const [editClassName, setEditClassName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [editingCandidateId, setEditingCandidateId] = useState('');
  const [editCandidateElectionId, setEditCandidateElectionId] = useState('');
  const [editCandidateName, setEditCandidateName] = useState('');
  const [editCandidatePositionId, setEditCandidatePositionId] = useState('');
  const [editCandidateNumber, setEditCandidateNumber] = useState('');
  const [editCandidatePhoto, setEditCandidatePhoto] = useState('');

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

  const editingCandidateElection = useMemo(
    () => elections.find((election) => election.id === editCandidateElectionId),
    [elections, editCandidateElectionId]
  );

  async function loadData() {
    setLoading(true);

    const [
      { data: electionsData, error: electionsError },
      { data: positionsData, error: positionsError },
      { data: candidatesData, error: candidatesError },
      { data: votersData, error: votersError },
      { data: votesData, error: votesError },
    ] = await Promise.all([
      supabase.from('elections').select('*').order('created_at', { ascending: true }),
      supabase.from('positions').select('*').order('created_at', { ascending: true }),
      supabase.from('candidates').select('*').order('created_at', { ascending: true }),
      supabase.from('voters').select('*').order('created_at', { ascending: true }),
      supabase.from('votes').select('*').order('created_at', { ascending: true }),
    ]);

    const firstError =
      electionsError || positionsError || candidatesError || votersError || votesError;

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
        validity_status: 'valida',
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

  function startEditElection(election) {
    setEditingElectionId(election.id);
    setEditClassName(election.className);
    setEditTitle(election.title);
    setEditDescription(election.description || '');
    setMessage('');
  }

  function cancelEditElection() {
    setEditingElectionId('');
    setEditClassName('');
    setEditTitle('');
    setEditDescription('');
  }

  async function saveElectionEdit() {
    if (!editingElectionId) return;
    if (!editClassName.trim()) {
      setMessage('Informe a turma para salvar a edição.');
      return;
    }

    const payload = {
      class_name: editClassName.trim(),
      title: editTitle.trim() || `Eleição da Turma ${editClassName.trim()}`,
      description: editDescription.trim(),
    };

    const { error } = await supabase.from('elections').update(payload).eq('id', editingElectionId);
    if (error) {
      setMessage(`Erro ao editar turma: ${error.message}`);
      return;
    }

    cancelEditElection();
    setMessage('Turma atualizada com sucesso.');
    await loadData();
  }

  function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCandidatePhoto(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  function handleEditCandidatePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditCandidatePhoto(String(reader.result || ''));
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

  function startEditCandidate(election, candidate) {
    setEditingCandidateId(candidate.id);
    setEditCandidateElectionId(election.id);
    setEditCandidateName(candidate.name);
    setEditCandidatePositionId(candidate.positionId);
    setEditCandidateNumber(candidate.number || '');
    setEditCandidatePhoto(candidate.photo || '');
    setMessage('');
  }

  function cancelEditCandidate() {
    setEditingCandidateId('');
    setEditCandidateElectionId('');
    setEditCandidateName('');
    setEditCandidatePositionId('');
    setEditCandidateNumber('');
    setEditCandidatePhoto('');
  }

  async function saveCandidateEdit() {
    if (!editingCandidateId) return;
    if (!editCandidateName.trim() || !editCandidatePositionId) {
      setMessage('Informe o nome e o cargo do candidato.');
      return;
    }

    const { error } = await supabase
      .from('candidates')
      .update({
        name: editCandidateName.trim(),
        number: editCandidateNumber.trim(),
        position_id: editCandidatePositionId,
        photo_url: editCandidatePhoto,
      })
      .eq('id', editingCandidateId);

    if (error) {
      setMessage(`Erro ao editar candidato: ${error.message}`);
      return;
    }

    cancelEditCandidate();
    setMessage('Candidato atualizado com sucesso.');
    await loadData();
  }

  async function deleteCandidate(candidateId) {
    const { error } = await supabase.from('candidates').delete().eq('id', candidateId);
    if (error) {
      setMessage(`Erro ao excluir candidato: ${error.message}`);
      return;
    }
    if (editingCandidateId === candidateId) {
      cancelEditCandidate();
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
    if (editingElectionId === electionId) {
      cancelEditElection();
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

  async function toggleElectionValidity(election) {
    const nextStatus = election.validityStatus === 'anulada' ? 'valida' : 'anulada';

    const { error } = await supabase
      .from('elections')
      .update({ validity_status: nextStatus })
      .eq('id', election.id);

    if (error) {
      setMessage(`Erro ao atualizar validade da eleição: ${error.message}`);
      return;
    }

    setMessage(
      nextStatus === 'anulada'
        ? 'Eleição anulada com sucesso.'
        : 'Eleição marcada como válida com sucesso.'
    );
    await loadData();
  }

  async function deleteVoterAndVotes(voterId, electionId) {
    const confirmation = window.confirm(
      'Deseja realmente remover este voto? Essa ação apagará o eleitor e todos os votos dele nesta eleição.'
    );

    if (!confirmation) return;

    const { error: votesError } = await supabase
      .from('votes')
      .delete()
      .eq('voter_id', voterId)
      .eq('election_id', electionId);

    if (votesError) {
      setMessage(`Erro ao excluir votos: ${votesError.message}`);
      return;
    }

    const { error: voterError } = await supabase
      .from('voters')
      .delete()
      .eq('id', voterId)
      .eq('election_id', electionId);

    if (voterError) {
      setMessage(`Erro ao excluir votante: ${voterError.message}`);
      return;
    }

    setMessage('Voto removido com sucesso.');
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

    if (currentElection.validityStatus === 'anulada') {
      setMessage('Esta eleição foi anulada e não pode receber votos.');
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

  function openElectionReport(election) {
    try {
      const groupedResults = getResultsByPosition(election);
      const candidateMap = new Map(
        (election.candidates || []).map((candidate) => [candidate.id, candidate])
      );

      const summaryRows = groupedResults
        .map((group) =>
          (group.ranked || [])
            .map(
              (candidate) => `
                <tr>
                  <td>${escapeHtml(group.position.name)}</td>
                  <td>${escapeHtml(candidate.name)}</td>
                  <td>${escapeHtml(candidate.number || '-')}</td>
                  <td>${escapeHtml(String(candidate.totalVotes ?? 0))}</td>
                  <td>${escapeHtml(String(candidate.percent ?? '0.0'))}%</td>
                </tr>
              `
            )
            .join('')
        )
        .join('');

      const voteRows = (election.votes || [])
        .map((vote, index) =>
          (vote.choices || [])
            .map((choice) => {
              const candidate = candidateMap.get(choice.candidateId);
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(vote.voterName)}</td>
                  <td>${escapeHtml(formatCpfForReport(vote.cpf))}</td>
                  <td>${escapeHtml(
                    choice.position ||
                      election.positions.find((p) => p.id === choice.positionId)?.name ||
                      '-'
                  )}</td>
                  <td>${escapeHtml(candidate?.name || 'Não identificado')}</td>
                  <td>${escapeHtml(candidate?.number || '-')}</td>
                </tr>
              `;
            })
            .join('')
        )
        .join('');

      const reportWindow = window.open('', '_blank', 'width=1200,height=900');

      if (!reportWindow) {
        setMessage('O navegador bloqueou a abertura da aba do relatório.');
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Relatório da votação - ${escapeHtml(election.className)}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 24px;
                color: #111827;
              }
              .header {
                border: 2px solid #0f172a;
                border-radius: 16px;
                padding: 20px;
                margin-bottom: 20px;
              }
              .header h1 {
                margin: 0 0 10px;
                font-size: 28px;
              }
              .header p {
                margin: 6px 0;
              }
              .section {
                margin-top: 24px;
              }
              .section h2 {
                margin: 0 0 12px;
                font-size: 22px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
              }
              th, td {
                border: 1px solid #cbd5e1;
                padding: 10px;
                text-align: left;
                font-size: 14px;
              }
              th {
                background: #e2e8f0;
              }
              .button-print {
                background: #0f172a;
                color: white;
                border: none;
                border-radius: 10px;
                padding: 10px 14px;
                cursor: pointer;
                margin-bottom: 16px;
              }
              .meta {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 12px;
                margin-top: 14px;
              }
              .meta-box {
                border: 1px solid #cbd5e1;
                border-radius: 12px;
                padding: 12px;
                background: #f8fafc;
              }
              .footer {
                margin-top: 28px;
                font-size: 13px;
                color: #475569;
              }
              @media print {
                .button-print {
                  display: none;
                }
                body {
                  margin: 10mm;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Boletim de Votação</h1>
              <p><strong>Escola:</strong> ${escapeHtml(election.schoolName)}</p>
              <p><strong>Turma:</strong> ${escapeHtml(election.className)}</p>
              <p><strong>Eleição:</strong> ${escapeHtml(election.title)}</p>
              <p><strong>Status:</strong> ${escapeHtml(String(election.status).toUpperCase())}</p>
              <p><strong>Validade:</strong> ${escapeHtml(
                election.validityStatus === 'anulada' ? 'ANULADA' : 'VÁLIDA'
              )}</p>

              <div class="meta">
                <div class="meta-box">
                  <strong>Total de votantes:</strong><br />${escapeHtml(String(election.votes.length))}
                </div>
                <div class="meta-box">
                  <strong>Link da turma:</strong><br />${escapeHtml(
                    `${window.location.origin}/votacao/${election.accessCode}`
                  )}
                </div>
              </div>
            </div>

            <button class="button-print" onclick="window.print()">Imprimir / Salvar em PDF</button>

            <div class="section">
              <h2>Apuração por cargo</h2>
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
              <h2>Registro nominal da votação</h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nome do eleitor</th>
                    <th>CPF</th>
                    <th>Cargo</th>
                    <th>Candidato escolhido</th>
                    <th>Número</th>
                  </tr>
                </thead>
                <tbody>
                  ${voteRows || '<tr><td colspan="6">Nenhum voto registrado.</td></tr>'}
                </tbody>
              </table>
            </div>

            <div class="footer">
              Relatório gerado automaticamente para fins de auditoria, conferência, transparência e lisura da votação.
            </div>
          </body>
        </html>
      `;

      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      setMessage(`Erro ao gerar relatório: ${error.message}`);
    }
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
                <p style={{ color: '#555', marginBottom: 10 }}>
                  {currentElection.description || 'Escolha um candidato para cada cargo disponível.'}
                </p>

                <div style={styles.inlineBadges}>
                  <span style={styles.statusBadgeNeutral}>
                    {currentElection.status === 'aberta' ? 'ELEIÇÃO ABERTA' : 'ELEIÇÃO ENCERRADA'}
                  </span>
                  <span
                    style={
                      currentElection.validityStatus === 'anulada'
                        ? styles.validityBadgeInvalid
                        : styles.validityBadgeValid
                    }
                  >
                    {currentElection.validityStatus === 'anulada'
                      ? 'ELEIÇÃO ANULADA'
                      : 'ELEIÇÃO VÁLIDA'}
                  </span>
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Nome completo</label>
                <input
                  style={styles.input}
                  value={voterName}
                  onChange={(e) => setVoterName(e.target.value)}
                />
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
                .filter((position) =>
                  currentElection.candidates.some((candidate) => candidate.positionId === position.id)
                )
                .map((position) => {
                  const positionCandidates = currentElection.candidates.filter(
                    (candidate) => candidate.positionId === position.id
                  );

                  return (
                    <div key={position.id} style={styles.positionBox}>
                      <h3 style={{ marginBottom: 6 }}>{position.name}</h3>
                      <p style={{ color: '#666', marginBottom: 12 }}>
                        Selecione um e somente um candidato.
                      </p>

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
                                  <div
                                    style={{
                                      ...styles.candidateName,
                                      color: active ? '#111827' : styles.candidateName.color,
                                    }}
                                  >
                                    {candidate.name}
                                  </div>
                                  <div
                                    style={{
                                      ...styles.candidateMeta,
                                      color: active ? '#1f2937' : styles.candidateMeta.color,
                                    }}
                                  >
                                    Nº {candidate.number || '-'}
                                  </div>
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
          <p style={styles.text}>
            Somente a administração acessa cadastro de candidatos, turmas e apuração.
          </p>

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
            <input
              style={styles.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Cargos</label>
            <input
              style={styles.input}
              value={positionsText}
              onChange={(e) => setPositionsText(e.target.value)}
            />
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
            <input
              style={styles.input}
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
            />
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
            <input
              style={styles.input}
              value={candidateNumber}
              onChange={(e) => setCandidateNumber(e.target.value)}
            />
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

      {editingElectionId ? (
        <div style={styles.card}>
          <h2 style={styles.title}>Editar turma</h2>

          <div style={styles.field}>
            <label style={styles.label}>Turma</label>
            <input
              style={styles.input}
              value={editClassName}
              onChange={(e) => setEditClassName(e.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Título da eleição</label>
            <input style={styles.input} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Descrição</label>
            <input
              style={styles.input}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>

          <div style={styles.buttonRow}>
            <button style={styles.primaryButton} onClick={saveElectionEdit}>
              Salvar edição da turma
            </button>
            <button style={styles.secondaryButton} onClick={cancelEditElection}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {editingCandidateId ? (
        <div style={styles.card}>
          <h2 style={styles.title}>Editar candidato</h2>

          <div style={styles.field}>
            <label style={styles.label}>Nome do candidato</label>
            <input
              style={styles.input}
              value={editCandidateName}
              onChange={(e) => setEditCandidateName(e.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Cargo disputado</label>
            <select
              style={styles.input}
              value={editCandidatePositionId}
              onChange={(e) => setEditCandidatePositionId(e.target.value)}
            >
              <option value="">Selecione</option>
              {(editingCandidateElection?.positions || []).map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Número do candidato</label>
            <input
              style={styles.input}
              value={editCandidateNumber}
              onChange={(e) => setEditCandidateNumber(e.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Foto do candidato</label>
            <input type="file" accept="image/*" onChange={handleEditCandidatePhotoUpload} />
            {editCandidatePhoto ? (
              <div style={styles.previewText}>Foto carregada para atualização.</div>
            ) : null}
          </div>

          <div style={styles.buttonRow}>
            <button style={styles.primaryButton} onClick={saveCandidateEdit}>
              Salvar edição do candidato
            </button>
            <button style={styles.secondaryButton} onClick={cancelEditCandidate}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

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
                <div style={styles.badgeColumn}>
                  <span style={styles.statusBadge}>
                    {election.status === 'aberta' ? 'ABERTA' : 'ENCERRADA'}
                  </span>
                  <span
                    style={
                      election.validityStatus === 'anulada'
                        ? styles.validityBadgeInvalid
                        : styles.validityBadgeValid
                    }
                  >
                    {election.validityStatus === 'anulada' ? 'ANULADA' : 'VÁLIDA'}
                  </span>
                </div>
              </div>

              <p><strong>Cargos:</strong> {election.positions.length}</p>
              <p><strong>Candidatos:</strong> {election.candidates.length}</p>
              <p><strong>Votantes:</strong> {election.votes.length}</p>

              <a
                href={`${window.location.origin}/votacao/${election.accessCode}`}
                target="_blank"
                rel="noreferrer"
                style={styles.linkBox}
              >
                {`${window.location.origin}/votacao/${election.accessCode}`}
              </a>

              <div style={styles.buttonRow}>
                <button style={styles.secondaryButton} onClick={() => toggleElectionStatus(election)}>
                  {election.status === 'aberta' ? 'Encerrar' : 'Reabrir'}
                </button>

                <button
                  style={election.validityStatus === 'anulada' ? styles.validButton : styles.warningButton}
                  onClick={() => toggleElectionValidity(election)}
                >
                  {election.validityStatus === 'anulada' ? 'Marcar válida' : 'Anular eleição'}
                </button>

                <button style={styles.editButton} onClick={() => startEditElection(election)}>
                  Editar turma
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
                          {candidate.position} · Nº {candidate.number || '-'}
                        </div>
                      </div>
                    </div>

                    <div style={styles.buttonRowSmall}>
                      <button
                        style={styles.editButtonSmall}
                        onClick={() => startEditCandidate(election, candidate)}
                      >
                        Editar
                      </button>
                      <button
                        style={styles.dangerButtonSmall}
                        onClick={() => deleteCandidate(candidate.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.voteManagerBox}>
                <h4 style={{ marginTop: 0 }}>Gerenciar votos</h4>

                {election.votes.length === 0 ? (
                  <p style={{ margin: 0, color: '#64748b' }}>Nenhum voto registrado.</p>
                ) : (
                  election.votes.map((vote) => (
                    <div key={vote.id} style={styles.voteRow}>
                      <div>
                        <div style={styles.candidateName}>{vote.voterName}</div>
                        <div style={styles.candidateMeta}>{formatCpfForReport(vote.cpf)}</div>
                      </div>

                      <button
                        style={styles.dangerButtonSmall}
                        onClick={() => deleteVoterAndVotes(vote.id, election.id)}
                      >
                        Remover voto
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.title}>Apuração</h2>

        {elections.map((election) => (
          <div key={election.id} style={{ marginBottom: 30 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>{election.className}</h3>
                <div style={styles.inlineBadges}>
                  <span style={styles.statusBadgeNeutral}>
                    {election.status === 'aberta' ? 'ELEIÇÃO ABERTA' : 'ELEIÇÃO ENCERRADA'}
                  </span>
                  <span
                    style={
                      election.validityStatus === 'anulada'
                        ? styles.validityBadgeInvalid
                        : styles.validityBadgeValid
                    }
                  >
                    {election.validityStatus === 'anulada' ? 'ELEIÇÃO ANULADA' : 'ELEIÇÃO VÁLIDA'}
                  </span>
                </div>
              </div>

              <button
                style={{ ...styles.primaryButton, padding: '10px 14px', fontSize: 14 }}
                onClick={() => openElectionReport(election)}
              >
                Gerar relatório completo
              </button>
            </div>

            <p>
              <strong>Link:</strong>{' '}
              <a
                href={`${window.location.origin}/votacao/${election.accessCode}`}
                target="_blank"
                rel="noreferrer"
              >
                {`${window.location.origin}/votacao/${election.accessCode}`}
              </a>
            </p>

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
  editButton: {
    background: '#2563eb',
    color: 'white',
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
  warningButton: {
    background: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    padding: '12px 18px',
    cursor: 'pointer',
    fontSize: 16,
  },
  validButton: {
    background: '#16a34a',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    padding: '12px 18px',
    cursor: 'pointer',
    fontSize: 16,
  },
  editButtonSmall: {
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: 14,
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
  badgeColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
  },
  inlineBadges: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 10,
    marginBottom: 4,
  },
  statusBadge: {
    background: '#dcfce7',
    color: '#166534',
    borderRadius: 999,
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 700,
  },
  statusBadgeNeutral: {
    background: '#e2e8f0',
    color: '#0f172a',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 700,
  },
  validityBadgeValid: {
    background: '#dcfce7',
    color: '#166534',
    borderRadius: 999,
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 700,
  },
  validityBadgeInvalid: {
    background: '#fee2e2',
    color: '#991b1b',
    borderRadius: 999,
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 700,
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
  buttonRowSmall: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
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
    color: '#111827',
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
  previewText: {
    marginTop: 8,
    color: '#2563eb',
    fontSize: 14,
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
    color: '#111827',
    borderRadius: 18,
    padding: 14,
    cursor: 'pointer',
  },
  candidateButtonActive: {
    border: '2px solid #0f172a',
    background: '#e2e8f0',
    color: '#111827',
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
  voteManagerBox: {
    marginTop: 18,
    borderTop: '1px solid #e5e7eb',
    paddingTop: 16,
  },
  voteRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0',
    borderTop: '1px solid #e5e7eb',
  },
};
