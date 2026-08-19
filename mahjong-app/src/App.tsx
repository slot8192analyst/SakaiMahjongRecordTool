import { useState, useEffect } from 'react'
import './App.css'
import { distributePoints } from './logic/score'

interface Member {
  id: number
  name: string
}

interface Settings {
  initialScore: number
  returnScore: number
  umaTop: number
  umaSecond: number
}

// 対局中のデータをまとめて持つ型
interface Round {
  wind: string
  num: number
}

interface GameState {
  seats: Member[]
  scores: Record<number, number> // key: memberId, value: 点数
  round: Round
  honba: number
  kyotaku: number
}

const WINDS = ['東', '南', '西', '北']

function App() {
  // どの画面を表示するかを管理する状態
  const [screen, setScreen] = useState<'setup' | 'record'>('setup')

  // ===== 対局設定画面用の状態 =====
  const [gameDate, setGameDate] = useState('2026-08-19')
  const [hanchanNo, setHanchanNo] = useState(1)
  const [members, setMembers] = useState<Member[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [seatOrder, setSeatOrder] = useState<number[]>([])

  // 対局が始まったら、ここに実際のゲームデータが入る
  const [game, setGame] = useState<GameState | null>(null)

  // ===== 記録画面：和了入力用の状態 =====
  const [agariKind, setAgariKind] = useState<'ron' | 'tsumo'>('ron')
  const [winnerId, setWinnerId] = useState<number | null>(null)
  const [loserId, setLoserId] = useState<number | null>(null)
  const [point, setPoint] = useState<number>(0)
  const [pointKo, setPointKo] = useState<number>(0)
  const [pointOya, setPointOya] = useState<number>(0)

  useEffect(() => {
    fetch('/members.json')
      .then((res) => res.json())
      .then((data) => {
        setMembers(data.members)
        setSettings(data.settings)
        // メンバーが読み込めたら、最初の4人を仮の座席順としてセットしておく
        setSeatOrder(data.members.slice(0, 4).map((m: Member) => m.id))
      })
      .catch((err) => console.error('読み込み失敗', err))
  }, [])

  // 座席(index番目)の選択が変わったときの処理
  const handleSeatChange = (seatIndex: number, memberId: number) => {
    const next = [...seatOrder]
    next[seatIndex] = memberId
    setSeatOrder(next)
  }

  // 重複チェック：同じ人が2つの座席に選ばれていないか
  const hasDuplicate = new Set(seatOrder).size !== seatOrder.length

  const handleStart = () => {
    if (hasDuplicate || !settings) {
      alert('同じメンバーが重複しています。')
      return
    }
    const seatMembers = seatOrder.map(
      (id) => members.find((m) => m.id === id)!
    )

    // 初期スコアをメンバーごとにセットする
    const initialScores: Record<number, number> = {}
    seatMembers.forEach((m) => {
      initialScores[m.id] = settings.initialScore
    })

    setGame({
      seats: seatMembers,
      scores: initialScores,
      round: { wind: '東', num: 1 },
      honba: 0,
      kyotaku: 0,
    })

    // 記録画面に切り替える
    setScreen('record')
  }

  // ===== 記録画面の表示 =====
  if (screen === 'record' && game) {
    const oyaIndex = (game.round.num - 1) % 4
    const oyaId = game.seats[oyaIndex].id
    const winnerIsOya = winnerId === oyaId

    const handleCalc = () => {
      if (winnerId == null) {
        alert('和了者を選んでください。')
        return
      }
      const memberIds = game.seats.map((m) => m.id)
      let result

      if (agariKind === 'ron') {
        if (loserId == null) {
          alert('放銃者を選んでください。')
          return
        }
        if (winnerId === loserId) {
          alert('和了者と放銃者が同じ人になっています。')
          return
        }
        result = distributePoints(
          { kind: 'ron', winnerId, loserId, point },
          memberIds
        )
      } else if (winnerIsOya) {
        result = distributePoints(
          { kind: 'tsumo', isOya: true, winnerId, point },
          memberIds
        )
      } else {
        result = distributePoints(
          {
            kind: 'tsumo',
            isOya: false,
            winnerId,
            oyaId,
            pointKo,
            pointOya,
          },
          memberIds
        )
      }

      if (!result.ok) {
        alert(result.message)
        return
      }

      const newScores = { ...game.scores }
      memberIds.forEach((id) => {
        newScores[id] += result.delta[id]
      })
      setGame({ ...game, scores: newScores })

      // 入力欄をリセットしておく（次の和了の入力をしやすくする）
      setWinnerId(null)
      setLoserId(null)
      setPoint(0)
      setPointKo(0)
      setPointOya(0)

      alert('記録しました！')
    }

    return (
      <div>
        <h2>記録画面</h2>
        <p>
          {game.round.wind}
          {game.round.num}局 {game.honba}本場 / 供託 {game.kyotaku}
        </p>
        <ul>
          {game.seats.map((m) => (
            <li key={m.id}>
              {m.id === oyaId ? '【親】' : '【子】'}
              {m.name}: {game.scores[m.id].toLocaleString()}点
            </li>
          ))}
        </ul>

        <h3>和了を記録</h3>
        <div>
          <label>種別: </label>
          <select
            value={agariKind}
            onChange={(e) => setAgariKind(e.target.value as 'ron' | 'tsumo')}
          >
            <option value="ron">ロン</option>
            <option value="tsumo">ツモ</option>
          </select>
        </div>
        <div>
          <label>和了者: </label>
          <select
            value={winnerId ?? ''}
            onChange={(e) => setWinnerId(Number(e.target.value))}
          >
            <option value="">選択してください</option>
            {game.seats.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {agariKind === 'ron' && (
          <>
            <div>
              <label>放銃者: </label>
              <select
                value={loserId ?? ''}
                onChange={(e) => setLoserId(Number(e.target.value))}
              >
                <option value="">選択してください</option>
                {game.seats
                  .filter((m) => m.id !== winnerId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label>点数: </label>
              <input
                type="number"
                step={100}
                value={point}
                onChange={(e) => setPoint(Number(e.target.value))}
              />
            </div>
          </>
        )}

        {agariKind === 'tsumo' && winnerIsOya && (
          <div>
            <label>各家からの支払い(all): </label>
            <input
              type="number"
              step={100}
              value={point}
              onChange={(e) => setPoint(Number(e.target.value))}
            />
          </div>
        )}

        {agariKind === 'tsumo' && !winnerIsOya && (
          <>
            <div>
              <label>子の支払い: </label>
              <input
                type="number"
                step={100}
                value={pointKo}
                onChange={(e) => setPointKo(Number(e.target.value))}
              />
            </div>
            <div>
              <label>親の支払い: </label>
              <input
                type="number"
                step={100}
                value={pointOya}
                onChange={(e) => setPointOya(Number(e.target.value))}
              />
            </div>
          </>
        )}

        <button onClick={handleCalc}>記録する</button>
      </div>
    )
  }

  // ===== 対局設定画面の表示 =====
  return (
    <div>
      <h2>対局設定</h2>
      <div>
        <label>日付</label>
        <input
          type="date"
          value={gameDate}
          onChange={(e) => setGameDate(e.target.value)}
        />
      </div>
      <div>
        <label>半荘</label>
        <input
          type="number"
          min={1}
          value={hanchanNo}
          onChange={(e) => setHanchanNo(Number(e.target.value))}
        />
        <span>半荘目</span>
      </div>

      <h3>参加メンバーを選択</h3>
      {seatOrder.map((memberId, index) => (
        <div key={index}>
          <span>{WINDS[index]}: </span>
          <select
            value={memberId}
            onChange={(e) => handleSeatChange(index, Number(e.target.value))}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      ))}

      {hasDuplicate && (
        <p style={{ color: 'red' }}>同じメンバーが重複しています</p>
      )}

      <button onClick={handleStart} disabled={hasDuplicate}>
        対局開始
      </button>
    </div>
  )
}

export default App
