import 'dotenv/config'
import * as fs from 'fs/promises'
import { PrismaClient } from '@prisma/client';
import express from 'express'
import multer from 'multer'
import { generateSecureRandomString, getFormattedTimestamp } from './utils';
const app = express()
const port = process.env.PORT || 3000
const upload = multer()

app.set("view engine", "ejs");
app.use(express.static('public'))
app.use(express.static('uploads'))
app.set('trust proxy', true)

const prisma = new PrismaClient()

app.get('/', (req, res) => {
  const currentTime = new Date().toLocaleTimeString();
  res.render('image-single', { time: currentTime })
})

app.get('/consultations', async (req, res) => {
  const consultations = await prisma.consultation.findMany({
    include: {
      file: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
  res.render('consultations', { consultations })
})

app.get('/uploads', async (req, res) => {
  res.send(await prisma.file.findMany())
})

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const createdFile = await prisma.$transaction(async (tx) => {
      const file = req.file
      if(!file) throw new Error('No File')
      const slug = generateSecureRandomString()
      const path = `${getFormattedTimestamp()}-${file.originalname.replace(/ /g, '-')}`
      const createdFile = await tx.file.create({
        data: {
          path,
          slug
        }
      })
      await fs.writeFile(`./uploads/${path}`, file.buffer)

      return createdFile
    })

    res.send({
      slug: createdFile.slug
    }) 
  } catch (error) {
    res.sendStatus(500)
  }
})

app.get('/:slug', async (req, res) => {
  const file = await prisma.file.findUnique({
    where: {
      slug: req.params.slug
    }
  })
  if(!file) {
    return res.render('404')
  }

  const createdConsultation = await prisma.consultation.create({
    data: {
      ip: req.headers['x-forwarded-for'] as string ?? req.ip! as string,
      fileId: file.id
    }
  })

  return res.render('image-single', { file })
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
