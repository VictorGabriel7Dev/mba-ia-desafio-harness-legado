import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Seed idempotente: pode rodar quantas vezes quiser no mesmo banco sem erro de
// "Unique constraint". Toda entidade usa upsert com chave estável (e-mail para
// usuários, id fixo para chamados e respostas), então a segunda subida apenas
// reafirma os mesmos dados em vez de duplicar.
const prisma = new PrismaClient()

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@balcao.dev' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@balcao.dev',
      passwordHash: await bcrypt.hash('Admin@123', 10),
      role: 'admin',
    },
  })

  const agent = await prisma.user.upsert({
    where: { email: 'agente@balcao.dev' },
    update: {},
    create: {
      name: 'Ana Atendente',
      email: 'agente@balcao.dev',
      passwordHash: await bcrypt.hash('Agente@123', 10),
      role: 'agent',
    },
  })

  const customer = await prisma.user.upsert({
    where: { email: 'cliente@balcao.dev' },
    update: {},
    create: {
      name: 'Carlos Cliente',
      email: 'cliente@balcao.dev',
      passwordHash: await bcrypt.hash('Cliente@123', 10),
      role: 'customer',
    },
  })

  // Chamados de exemplo com id fixo, para o upsert reconhecer o mesmo registro
  // em execuções repetidas.
  await prisma.ticket.upsert({
    where: { id: 'seed-ticket-boleto' },
    update: {},
    create: {
      id: 'seed-ticket-boleto',
      title: 'Não consigo emitir a segunda via do boleto',
      description: 'Quando clico em segunda via aparece uma tela em branco. Preciso pagar até sexta.',
      customerId: customer.id,
    },
  })

  await prisma.ticket.upsert({
    where: { id: 'seed-ticket-perfil' },
    update: {},
    create: {
      id: 'seed-ticket-perfil',
      title: 'Erro ao salvar o perfil',
      description: 'Ao alterar o telefone no perfil aparece a mensagem "erro inesperado".',
      status: 'in_progress',
      category: 'technical',
      priority: 'medium',
      triageStatus: 'done',
      customerId: customer.id,
      assigneeId: agent.id,
    },
  })

  await prisma.ticket.upsert({
    where: { id: 'seed-ticket-senha' },
    update: {},
    create: {
      id: 'seed-ticket-senha',
      title: 'Dúvida sobre troca de senha',
      description: 'Qual o tamanho mínimo de senha que o sistema aceita?',
      status: 'resolved',
      category: 'account',
      priority: 'low',
      triageStatus: 'done',
      customerId: customer.id,
      assigneeId: agent.id,
    },
  })

  // Respostas de exemplo, também com id fixo (upsert separado do chamado para
  // não recriar o aninhado a cada subida).
  await prisma.reply.upsert({
    where: { id: 'seed-reply-perfil-1' },
    update: {},
    create: {
      id: 'seed-reply-perfil-1',
      ticketId: 'seed-ticket-perfil',
      authorId: agent.id,
      body: 'Oi, Carlos! Já estamos olhando o problema.',
    },
  })

  await prisma.reply.upsert({
    where: { id: 'seed-reply-senha-1' },
    update: {},
    create: {
      id: 'seed-reply-senha-1',
      ticketId: 'seed-ticket-senha',
      authorId: agent.id,
      body: 'A senha precisa ter pelo menos 8 caracteres.',
    },
  })

  await prisma.reply.upsert({
    where: { id: 'seed-reply-senha-2' },
    update: {},
    create: {
      id: 'seed-reply-senha-2',
      ticketId: 'seed-ticket-senha',
      authorId: customer.id,
      body: 'Obrigado!',
    },
  })

  console.log(`seed ok: ${admin.email}, ${agent.email}, ${customer.email}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
