# 1분 복용 점검 — 상식 규칙 초안 (약사 검수용)

코드: `care-app/src/lib/quickCheckRules.ts` (`RULES`). 종류명 칩(혈압약, 오메가3 …)과 기본 정보(연령대·해당 항목)에 맞춰 돌리는 규칙이다.
제품명(검색·사진)은 이 규칙이 아니라 식약처 DUR 병용금기 자료로 대조한다.

**이 표는 널리 알려진 약물 상식을 옮긴 초안이며 약사 검수 전이다.** 검수 결과에 따라 문구·등급(kind)·태그를 바꾸거나 규칙을 지운다. 문구 원칙: 어르신용 쉬운 한국어, 단정 대신 "~할 수 있어 확인이 필요해요", 결론은 항상 약사·의료진 확인.

| kind | 등급 | 조합 (A × B) | 태그 | 사용자에게 보이는 문구 | 근거 메모 (basis) | 검수 의견 |
|---|---|---|---|---|---|---|
| priority | 우선 확인 필요 | 통증·소염제 × 혈압약 | 우선 확인 필요 | 진통·소염제를 오래 드시면 혈압약 효과가 줄고 신장에 부담이 갈 수 있어 확인이 필요해요. | NSAID–antihypertensive (ACEi/ARB/diuretic) BP attenuation, renal risk |  |
| priority | 우선 확인 필요 | 항우울제 × 통증·소염제 | 우선 확인 필요 | 함께 드시면 위장 출혈 위험이 높아질 수 있어 확인이 필요해요. | SSRI–NSAID GI bleeding risk |  |
| priority | 우선 확인 필요 | 오메가3 × 통증·소염제 | 우선 확인 필요 | 둘 다 피가 잘 멎지 않게 할 수 있어, 함께 드시면 멍이나 출혈이 잦아지는지 확인이 필요해요. | omega-3 antiplatelet effect + NSAID bleeding tendency |  |
| priority | 우선 확인 필요 | 임신·수유 중 × 여드름약 | 우선 확인 필요 | 일부 여드름약은 임신·수유 중에 태아나 아기에게 위험할 수 있어요. 반드시 의료진과 확인해 주세요. | isotretinoin teratogenicity; tetracyclines contraindicated in pregnancy |  |
| priority | 우선 확인 필요 | 임신·수유 중 × 고지혈증약 | 우선 확인 필요 | 고지혈증약은 임신·수유 중에 권하지 않는 경우가 많아요. 반드시 의료진과 확인해 주세요. | statins contraindicated/not recommended in pregnancy and lactation |  |
| priority | 우선 확인 필요 | 신장질환 × 통증·소염제 | 우선 확인 필요 | 신장이 약한 분이 진통·소염제를 드시면 신장 기능이 더 나빠질 수 있어 확인이 필요해요. | NSAID nephrotoxicity in CKD |  |
| priority | 우선 확인 필요 | 신장질환 × 마그네슘 | 우선 확인 필요 | 신장이 약하면 마그네슘이 몸에 쌓일 수 있어, 영양제로 드셔도 되는지 확인이 필요해요. | hypermagnesemia risk with reduced renal clearance |  |
| priority | 우선 확인 필요 | 간질환 × 통증·소염제 | 우선 확인 필요 | 간이 약한 분은 진통·소염제 종류와 용량을 꼭 확인해야 해요. 특히 아세트아미노펜(타이레놀 계열)은 간에 부담이 될 수 있어요. | acetaminophen hepatotoxicity; NSAID caution in hepatic impairment |  |
| timing | 복용 시간 조정 | 철분 × 갑상선약 | 복용 시간 확인 필요 | 함께 드시면 갑상선약 흡수가 줄 수 있어요. 4시간 이상 간격을 두고 드시는 게 좋은지 확인이 필요해요. | levothyroxine–iron chelation; separate ≥4h |  |
| timing | 복용 시간 조정 | 마그네슘 × 갑상선약 | 복용 시간 확인 필요 | 함께 드시면 갑상선약 흡수가 줄 수 있어요. 시간을 나눠 드시는 게 좋은지 확인이 필요해요. | levothyroxine absorption reduced by magnesium salts; separate ≥4h |  |
| timing | 복용 시간 조정 | 위장약 × 갑상선약 | 복용 시간 확인 필요 | 제산제나 위산을 줄이는 약은 갑상선약 흡수를 낮출 수 있어요. 복용 간격 확인이 필요해요. | antacids (Al/Mg/Ca) chelate levothyroxine; PPIs reduce absorption |  |
| timing | 복용 시간 조정 | 위장약 × 철분 | 복용 시간 확인 필요 | 위산을 줄이는 약과 함께 드시면 철분 흡수가 줄 수 있어요. 시간을 나눠 드시는 게 좋은지 확인이 필요해요. | iron absorption requires gastric acid; antacid/PPI reduce absorption |  |
| timing | 복용 시간 조정 | 아연 × 철분 | 복용 시간 확인 필요 | 아연과 철분은 서로 흡수를 방해할 수 있어요. 시간을 나눠 드시는 게 좋은지 확인이 필요해요. | zinc–iron competitive absorption (DMT1) |  |
| overlap | 중복·과다 확인 | 종합비타민 × 비타민D | 중복 성분 확인 | 종합비타민에 비타민D가 이미 들어 있는 경우가 많아요. 성분표를 보고 겹치지 않는지 확인이 필요해요. | multivitamin commonly contains vitamin D — duplicate intake |  |
| overlap | 중복·과다 확인 | 종합비타민 × 철분 | 중복 성분 확인 | 종합비타민에 철분이 이미 들어 있는 경우가 많아요. 성분표를 보고 겹치지 않는지 확인이 필요해요. | multivitamin commonly contains iron — duplicate intake |  |
| overlap | 중복·과다 확인 | 종합비타민 × 마그네슘 | 중복 성분 확인 | 종합비타민에 마그네슘이 이미 들어 있는 경우가 많아요. 성분표를 보고 겹치지 않는지 확인이 필요해요. | multivitamin commonly contains magnesium — duplicate intake |  |
| overlap | 중복·과다 확인 | 종합비타민 × 아연 | 중복 성분 확인 | 종합비타민에 아연이 이미 들어 있는 경우가 많아요. 성분표를 보고 겹치지 않는지 확인이 필요해요. | multivitamin commonly contains zinc — duplicate intake |  |
| overlap | 중복·과다 확인 | 종합비타민 × 루테인 | 중복 성분 확인 | 종합비타민에 루테인이 들어 있는 제품도 있어요. 성분표를 보고 겹치지 않는지 확인이 필요해요. | some multivitamins include lutein — duplicate intake |  |
| overlap | 중복·과다 확인 | 위장약 × 마그네슘 | 중복 성분 확인 | 제산제 중에는 마그네슘이 든 것이 있어요. 마그네슘 영양제와 겹치면 설사 등이 생길 수 있어 확인이 필요해요. | magnesium-containing antacids + magnesium supplement — additive load, diarrhea |  |
| overlap | 중복·과다 확인 | 여드름약 × 종합비타민 | 과다 복용 확인 | 일부 여드름약은 비타민A 계열이에요. 종합비타민의 비타민A와 겹치면 과다가 될 수 있어 확인이 필요해요. | isotretinoin + vitamin A supplements — hypervitaminosis A |  |
| caution | 주의사항 | 항우울제 × 알레르기약 | 주의사항 | 함께 드시면 졸음이 더 심해질 수 있어요. 운전이나 외출 전에는 확인이 필요해요. | additive sedation: antidepressants + first-generation antihistamines |  |
| caution | 주의사항 | 60대 이상 × 알레르기약 | 주의사항 | 알레르기약은 졸음이나 어지럼을 일으킬 수 있어 넘어짐에 주의가 필요해요. 덜 졸린 약이 있는지 확인해 보세요. | Beers criteria: first-generation antihistamines in older adults — sedation, falls |  |
| caution | 주의사항 | 60대 이상 × 통증·소염제 | 주의사항 | 진통·소염제를 오래 드시면 위장과 신장에 부담이 될 수 있어요. 장기 복용 중이라면 확인이 필요해요. | Beers criteria: chronic NSAID use in older adults — GI bleeding, renal |  |
| caution | 주의사항 | 홍삼 × 혈압약 | 주의사항 | 홍삼은 사람에 따라 혈압을 변하게 할 수 있어요. 혈압약과 함께 드시면 혈압을 자주 재 보고 확인이 필요해요. | ginseng may alter blood pressure; monitor with antihypertensives |  |
| caution | 주의사항 | 여드름약 × 피임약 | 주의사항 | 여드름약 종류에 따라 피임약과 함께 드시는 방법이 달라요. 복용 방법 확인이 필요해요. | isotretinoin requires reliable contraception; some antibiotics/OC interaction advice |  |

총 25개 규칙.

## 검수 시 확인 부탁드리는 점

- 등급(kind)이 적절한가: priority(우선 확인 필요) / timing(복용 시간 조정) / overlap(중복·과다 확인) / caution(주의사항).
- 문구가 과장·단정으로 읽히지 않는가. "간격 4시간"처럼 숫자를 넣은 항목은 특히 확인 부탁드립니다.
- 빠진 조합 중 이 칩 목록 안에서 꼭 넣어야 할 것이 있는가 (칩: 영양제 12종, 복용약 9종, 연령대 5, 해당 항목 3).
- 검토 후 이 파일과 `quickCheckRules.ts`를 함께 고칩니다. 테스트: `cd care-app && npx jest quickCheckRules`.
