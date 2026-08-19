// 点数のやり取りを計算する純粋関数
// UIやReactの状態には一切触れない、入力を受け取って結果を返すだけの関数

export interface RonInput {
  kind: 'ron'
  winnerId: number
  loserId: number
  point: number
}

export interface TsumoOyaInput {
  kind: 'tsumo'
  isOya: true
  winnerId: number
  point: number // 子全員が払う各額
}

export interface TsumoKoInput {
  kind: 'tsumo'
  isOya: false
  winnerId: number
  oyaId: number
  pointKo: number // 子が払う額
  pointOya: number // 親が払う額
}

// "|" でつなぐことで「このどれか一つの形になる」という型(Union型)を表現できる
export type DistributeInput = RonInput | TsumoOyaInput | TsumoKoInput

export interface DistributeResult {
  ok: boolean
  message?: string
  delta: Record<number, number> // memberId -> 増減
}

export function distributePoints(
  input: DistributeInput,
  memberIds: number[]
): DistributeResult {
  const delta: Record<number, number> = {}
  memberIds.forEach((id) => {
    delta[id] = 0
  })

  // input.kind の値によって、TypeScriptが自動的に
  // inputの型を絞り込んでくれる(これを「型の絞り込み」と呼ぶ)
  if (input.kind === 'ron') {
    if (!input.point) {
      return { ok: false, message: '点数が入力されていません。', delta }
    }
    delta[input.winnerId] += input.point
    delta[input.loserId] -= input.point
    return { ok: true, delta }
  }

  if (input.kind === 'tsumo' && input.isOya) {
    if (!input.point) {
      return { ok: false, message: '支払額(all)が入力されていません。', delta }
    }
    let gained = 0
    memberIds.forEach((id) => {
      if (id === input.winnerId) return
      delta[id] -= input.point
      gained += input.point
    })
    delta[input.winnerId] += gained
    return { ok: true, delta }
  }

  if (input.kind === 'tsumo' && !input.isOya) {
    if (!input.pointKo || !input.pointOya) {
      return { ok: false, message: '子払い・親払いが入力されていません。', delta }
    }
    let gained = 0
    memberIds.forEach((id) => {
      if (id === input.winnerId) return
      const pay = id === input.oyaId ? input.pointOya : input.pointKo
      delta[id] -= pay
      gained += pay
    })
    delta[input.winnerId] += gained
    return { ok: true, delta }
  }

  return { ok: false, message: '不明な種別です。', delta }
}
