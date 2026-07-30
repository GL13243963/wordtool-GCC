import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { WordProgress } from '../study/types'
import type { Word } from '../vocabulary/types'

export type WrongWordCard = {
  word: Word
  progress: WordProgress
}

const cardBorders = {
  top: { style: BorderStyle.SINGLE, size: 8, color: 'D8DEE9' },
  bottom: { style: BorderStyle.SINGLE, size: 8, color: 'D8DEE9' },
  left: { style: BorderStyle.SINGLE, size: 8, color: 'D8DEE9' },
  right: { style: BorderStyle.SINGLE, size: 8, color: 'D8DEE9' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

const createCardCell = ({ word, progress }: WrongWordCard) => new TableCell({
  borders: cardBorders,
  margins: { top: 280, bottom: 280, left: 320, right: 320 },
  width: { size: 4680, type: WidthType.DXA },
  children: [
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: word.text, bold: true, size: 34, color: '1E3A8A', font: 'Arial' }),
        ...(word.phonetic ? [new TextRun({ text: `  ${word.phonetic}`, size: 20, color: '64748B', font: 'Arial' })] : []),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: word.partOfSpeech ? `${word.partOfSpeech}  ` : '', bold: true, size: 20, color: '475569', font: 'Microsoft YaHei' }),
        new TextRun({ text: word.meaningZh.join('；'), size: 22, font: 'Microsoft YaHei' }),
      ],
    }),
    ...(word.example ? [
      new Paragraph({
        spacing: { after: 50 },
        children: [new TextRun({ text: word.example, italics: true, size: 19, color: '334155', font: 'Arial' })],
      }),
    ] : []),
    ...(word.exampleZh ? [
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: word.exampleZh, size: 18, color: '64748B', font: 'Microsoft YaHei' })],
      }),
    ] : []),
    new Paragraph({
      children: [
        new TextRun({
          text: `错误 ${progress.wrongCount} 次  ·  正确 ${progress.correctCount} 次  ·  掌握度 ${Math.round(progress.masteryScore)}%`,
          size: 17,
          color: 'B45309',
          font: 'Microsoft YaHei',
        }),
      ],
    }),
  ],
})

const createEmptyCell = () => new TableCell({
  borders: cardBorders,
  width: { size: 4680, type: WidthType.DXA },
  children: [new Paragraph('')],
})

export const createWrongWordsDocument = (cards: WrongWordCard[]) => {
  const rows: TableRow[] = []
  for (let index = 0; index < cards.length; index += 2) {
    rows.push(new TableRow({
      cantSplit: true,
      children: [
        createCardCell(cards[index]),
        cards[index + 1] ? createCardCell(cards[index + 1]) : createEmptyCell(),
      ],
    }))
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Microsoft YaHei', size: 20 },
          paragraph: { spacing: { after: 100, line: 276 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: '郭城成的英语错题记忆卡', bold: true, size: 38, color: '1E3A8A', font: 'Microsoft YaHei' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [new TextRun({
            text: `导出日期：${new Date().toLocaleDateString('zh-CN')}  ·  共 ${cards.length} 个待巩固单词`,
            size: 18,
            color: '64748B',
            font: 'Microsoft YaHei',
          })],
        }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          indent: { size: 120, type: WidthType.DXA },
          columnWidths: [4680, 4680],
          rows,
        }),
      ],
    }],
  })
}

export const downloadWrongWordsDocument = async (cards: WrongWordCard[]) => {
  const blob = await Packer.toBlob(createWrongWordsDocument(cards))
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `郭城成-英语错题记忆卡-${new Date().toLocaleDateString('sv-SE')}.docx`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
