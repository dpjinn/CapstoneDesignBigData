from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

api_key = os.getenv("OPENAI_API_KEY")

# API 키가 제대로 읽혔는지 확인
print("API KEY 존재:", bool(api_key))
print("KEY:", api_key[:10] if api_key else None)

# OpenAI 클라이언트 생성
client = OpenAI(api_key=api_key)

# CORS 설정
CORS(
    app,
    resources={
        r"/chat": {
            "origins": "*"
        }
    },
    methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"]
)


@app.route("/chat", methods=["POST", "OPTIONS"])
def chat():

    if request.method == "OPTIONS":
        return "", 204


    data = request.get_json()


    question = data.get("question", "")

    game = data.get("game", "")

    reviews = data.get("reviews", [])


    if not question:

        return jsonify({
            "answer": "질문을 입력해주세요."
        }), 400


    try:

        # 리뷰 데이터를 텍스트로 변환
        review_text = "\n\n".join(

            [
                f"[{review.get('sentiment', '')}] "
                f"{review.get('review', '')}"

                for review in reviews
            ]

        )


        prompt = f"""
당신은 게임 리뷰 분석 AI입니다.

아래 데이터는 사용자가 현재 선택한 게임의
GitHub CSV 리뷰 데이터입니다.

게임 이름:
{game}

리뷰 데이터:
{review_text}


사용자 질문:
{question}


답변 규칙:

1. 반드시 위 리뷰 데이터를 근거로 답변하세요.
2. 리뷰에 없는 내용을 사실처럼 만들어내지 마세요.
3. 긍정 리뷰와 부정 리뷰를 구분해서 판단하세요.
4. 여러 리뷰에서 반복적으로 나타나는 의견이 있다면 언급하세요.
5. 질문과 관련된 리뷰가 없다면
   "제공된 리뷰 데이터에서는 확인하기 어렵습니다."
   라고 답변하세요.
6. 게임에 대한 일반적인 지식보다 제공된 리뷰 데이터를 우선하세요.
"""


        response = client.responses.create(

            model="gpt-4o-mini",

            input=prompt

        )


        return jsonify({

            "answer":
                response.output_text

        })


    except Exception as e:

        print(
            "OpenAI 오류:",
            e
        )


        return jsonify({

            "answer":
                "AI 응답을 생성하는 중 오류가 발생했습니다."

        }), 500

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )