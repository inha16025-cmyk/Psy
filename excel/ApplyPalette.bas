Attribute VB_Name = "ApplyPalette"
' 선택한 차트에 "랜덤" 시트의 현재 팔레트(10행 HEX)를 순서대로 적용합니다.
' 사용: 차트를 클릭해 선택 -> Alt+F8 -> ApplyPaletteToChart
Option Explicit

Private Function HexToRGB(ByVal h As String) As Long
    h = Replace(Trim$(h), "#", "")
    HexToRGB = RGB(CLng("&H" & Mid$(h, 1, 2)), CLng("&H" & Mid$(h, 3, 2)), CLng("&H" & Mid$(h, 5, 2)))
End Function

Public Sub ApplyPaletteToChart()
    Dim cht As Chart, ws As Worksheet
    Dim colors() As Long, n As Long, j As Long, i As Long, v As Variant

    If ActiveChart Is Nothing Then
        MsgBox "먼저 색을 넣을 차트를 클릭해서 선택해 주세요.", vbInformation
        Exit Sub
    End If
    Set cht = ActiveChart
    Set ws = ActiveChart.Parent.Parent.Parent.Worksheets("랜덤")

    ' 고정값으로 복사해 두지 않으면 계산 중 색이 바뀔 수 있으므로 지금 값을 먼저 읽어 둡니다.
    ReDim colors(1 To 8)
    For j = 1 To 8
        v = ws.Cells(10, 2 + j).Value
        If Len(CStr(v)) = 7 Then
            n = n + 1
            colors(n) = HexToRGB(CStr(v))
        End If
    Next j
    If n = 0 Then
        MsgBox "'랜덤' 시트 10행에서 색을 찾지 못했습니다.", vbExclamation
        Exit Sub
    End If

    If cht.SeriesCollection.Count = 1 Then
        ' 계열이 하나면(원형·도넛·단일 막대) 조각/막대마다 색을 넣습니다.
        With cht.SeriesCollection(1)
            For i = 1 To .Points.Count
                .Points(i).Format.Fill.ForeColor.RGB = colors(((i - 1) Mod n) + 1)
                .Points(i).Format.Line.ForeColor.RGB = colors(((i - 1) Mod n) + 1)
            Next i
        End With
    Else
        For i = 1 To cht.SeriesCollection.Count
            With cht.SeriesCollection(i)
                .Format.Fill.ForeColor.RGB = colors(((i - 1) Mod n) + 1)
                .Format.Line.ForeColor.RGB = colors(((i - 1) Mod n) + 1)
                On Error Resume Next   ' 표식이 없는 차트 유형은 건너뜀
                .MarkerBackgroundColor = colors(((i - 1) Mod n) + 1)
                .MarkerForegroundColor = colors(((i - 1) Mod n) + 1)
                On Error GoTo 0
            End With
        Next i
    End If
    MsgBox n & "가지 색을 적용했습니다.", vbInformation
End Sub
