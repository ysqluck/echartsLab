<script setup lang="ts">
import { watch, ref, onMounted, nextTick, computed, defineProps, toRef } from 'vue';
let props = defineProps({
    loading: {
        type: Boolean,
        default: false,
        required: true
    },
    chart: {
        type: Object,
        default: {},
        required: true
    },
    radioId: {
        type: Number,
        default: 2,
        required: true
    },
    drawerFlag: {
        type: Boolean,
        default: false,
    },
    showControlBtn: {
        type: Boolean,
        default: true
    },
})

/**
 * drag逻辑
*/
const echartsOuterBoxDom = ref()
const checkBoxDom = ref()
let draggable = (parentBox: HTMLElement, dragBox: HTMLElement): void => {
    // 记住盒子的当前位置
    const boxRect = dragBox.getBoundingClientRect();
    let startPosition = { x: 0, y: 0 };
    let startBoxPosition = { x: boxRect.left, y: boxRect.top };
    let isDragging = false;

    let onMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        if (!isDragging) return;
        let deltaX = e.clientX - startPosition.x;
        let deltaY = e.clientY - startPosition.y;
        let newLeft = startBoxPosition.x + deltaX;
        let newTop = startBoxPosition.y + deltaY;

        newLeft = Math.max(0, Math.min(newLeft, parentBox.clientWidth - dragBox.clientWidth));
        newTop = Math.max(0, Math.min(newTop, parentBox.clientHeight - dragBox.clientHeight));

        dragBox.style.left = newLeft + 'px';
        dragBox.style.top = newTop + 'px';
    }

    let onMouseUp = (e: MouseEvent) => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    let onMouseDown = (e: MouseEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        isDragging = true;
        startPosition = { x: e.clientX, y: e.clientY };
        startBoxPosition = { x: dragBox.offsetLeft, y: dragBox.offsetTop };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    dragBox.removeEventListener('mousedown', onMouseDown);
    dragBox.addEventListener('mousedown', onMouseDown);
}



let showChartCheckBox = ref<boolean>(true)
let echartThemeColorList = ref<[]>([])
let echartsDataForRenderCheckBoxList = ref([])
const resCurTabAllCopyLine = ref<[]>([])

function getOptionAndChart() {
    let option, chart
    if (props.chart.value) {
        option = props.chart.value.getOption()
        chart = props.chart.value
    } else {
        option = props.chart.getOption()
        chart = props.chart
    }
    return {
        option,
        chart
    }
}
async function synchronization(option: any, chart: any) {
    option.series = echartsDataForRenderCheckBoxList.value
    await chart.setOption(option, true)
    resetCheckBoxLineColor()
    hightLightAction(false)
}

/**
 * 复制or删除
*/
let copyLineRename = ref({ name: "", copyLineInstance: {} })

let showDoubleConfirmCopyRenameBox = ref(false)
let doubleConfirmCopyRenameBox = ref()
let renameInput = ref()
let handleClickSure = () => {
    let { option, chart } = getOptionAndChart()
    if (copyLineRename.value.name) {
        copyLineRename.value.copyLineInstance.name = `${copyLineRename.value.name}`
    }
    if (copyLineRename.value.copyShadowData) {
        copyLineRename.value.copyShadowData.name = `${copyLineRename.value.copyLineInstance.name}_polygonShadow`
        echartsDataForRenderCheckBoxList.value.push(copyLineRename.value.copyShadowData)
    }
    echartsDataForRenderCheckBoxList.value.push(copyLineRename.value.copyLineInstance)

    synchronization(option, chart)
    // // 发送请求给后端
    if (copyLineRename.value.copyShadowData) {
        copyLineRename.value.copyLineInstance.copyShadowData = copyLineRename.value.copyShadowData
    }
    copyCurveAction(copyLineRename.value.copyLineInstance)
    showDoubleConfirmCopyRenameBox.value = false
    copyLineRename.value = { name: "", copyLineInstance: {} }
}
let handleCopyAndDel = (index: number, copyFlag: boolean, itemLine: any) => {
    let { option, chart } = getOptionAndChart()
    if (copyFlag) {
        // 如果是复制出来的就可以删除
        // let otherLine = option.series.filter(item => !item.name)
        // let spliceArr = option.series.filter(item => item.name)
        let delLine = echartsDataForRenderCheckBoxList.value.splice(echartsDataForRenderCheckBoxList.value.findIndex(item => itemLine.name === item.name), 1)
        if (echartsDataForRenderCheckBoxList.value.find(item => item.name === `${itemLine.name}_polygonShadow`)) {
            echartsDataForRenderCheckBoxList.value.splice(echartsDataForRenderCheckBoxList.value.findIndex(item => `${itemLine.name}_polygonShadow` === item.name), 1)
        }
        // echartsDataForRenderCheckBoxList.value = [...spliceArr, ...otherLine]
        option.series = echartsDataForRenderCheckBoxList.value
        // 删除之后同步修改echarts数据
        synchronization(option, chart)
        // 发送请求
        deleteCurveAction(delLine)
    } else {
        // 拿到复制的数据
        let copySeriesItem = chart.getOption().series[index]
        // copyLine的颜色需要和原来线的颜色一样
        const echartsDefaultColor = chart.getOption().color
        copySeriesItem.lineStyle = {
            color: copySeriesItem.lineStyle.color ? copySeriesItem.lineStyle.color : echartsDefaultColor[index % 9],
            width: copySeriesItem.lineStyle.width ? copySeriesItem.lineStyle.width : 2
        }
        copySeriesItem.itemStyle = {
            color: copySeriesItem.lineStyle.color ? copySeriesItem.lineStyle.color : echartsDefaultColor[index % 9]
        }
        if (copySeriesItem.markArea) {
            copySeriesItem.markArea.itemStyle.color = copySeriesItem.markArea.itemStyle.color ? copySeriesItem.markArea.itemStyle.color : copySeriesItem.lineStyle.color
            copySeriesItem.markArea.itemStyle.borderWidth = 0
            copySeriesItem.markArea.itemStyle.opacity = 0.3
        }
        // 查找是否有阴影
        let copyShadow
        if (echartsDataForRenderCheckBoxList.value.find(item => item.name === `${copySeriesItem.name}_polygonShadow`)) {
            // 如果有阴影就应该复制阴影
            copyShadow = JSON.parse(JSON.stringify(echartsDataForRenderCheckBoxList.value.find(item => item.name === `${copySeriesItem.name}_polygonShadow`)))
            copyShadow.renderItem = echartsDataForRenderCheckBoxList.value.find(item => item.name === `${copySeriesItem.name}_polygonShadow`)?.renderItem
            copyShadow.sourceName = `${copySeriesItem.name}_polygonShadow`
            copyShadow.legendHoverLink = true
            copyShadow.silent = true
        }
        // 增加属性isCopy
        copySeriesItem.copyFlag = true
        // 打开renameDialog
        showDoubleConfirmCopyRenameBox.value = true
        copyLineRename.value.name = addUniqueNameItem(echartsDataForRenderCheckBoxList.value, copySeriesItem).name
        // 保存复制线的data
        copyLineRename.value.copyLineInstance = copySeriesItem

        if (copyShadow) {
            // 如果有阴影，则需要将生成的阴影一起保存
            copyLineRename.value.copyShadowData = copyShadow
            // copyShadow.name = `${name.name}_polygonShadow`
            // echartsDataForRenderCheckBoxList.value.push(copyShadow)
        }

    }
}
function addUniqueNameItem(arr: any, item: any) {
    // 检查数组中是否已存在具有相同name的对象
    const existingItem = arr.find(obj => obj.name === item.name);
    // 如果存在，增加一个索引并设置新的名字
    if (existingItem) {
        let index = 1;
        // 查找当前name后的最大索引
        while (arr.some(obj => obj.name === `${item.name}${index}`)) {
            index++;
        }
        item.name = `${item.name}${index}`; // 设置新的名字
    }
    // 将新对象添加到数组中
    // arr.push(item);
    return item
}

/**
 * 根据当前checkBox的状态显隐对应的series
*/
let showWhichLine = (): void => {
    nextTick(() => {
        let checkItemOuter = echartsOuterBoxDom.value.querySelector('.chartCheckBox')
        if (!checkItemOuter) return; // 如果元素不存在，则直接返回
        // change逻辑：事件代理 通过顶级盒子来判断哪一个checkBox选中并显隐echarts中对应的series
        // 先移除旧的点击事件监听
        checkItemOuter?.removeEventListener('click', handleClick)
        checkItemOuter?.addEventListener('click', handleClick)
    })
}
const dashedLineNameList = new Map()
dashedLineNameList.set('管内循环压力', '虚线_管内循环压力link环空循环压力')
dashedLineNameList.set('环空循环压力', '虚线_管内循环压力link环空循环压力')
dashedLineNameList.set('立管压力', '虚线_立管压力link环空压力')
dashedLineNameList.set('环空压力', '虚线_立管压力link环空压力')

let handleClick = (e: any) => {
    let { option, chart } = getOptionAndChart()
    if (e.target.type === 'checkbox') {
        let seriesLineIndex = option.series.findIndex(item => item.name === e.target.name)
        // (option.series)
        // 这个版本在series属性中设置show有bug需要对当前选择的线的宽度进行调整
        e.target.checked ? option.series[seriesLineIndex].lineStyle.width = 4 : option.series[seriesLineIndex].lineStyle.width = 0
        // if (e.target.checked) {
        //     if (option.series[seriesLineIndex].markArea) {
        //         if (option.series[seriesLineIndex].copyFlag) {
        //             option.series[seriesLineIndex].markArea.itemStyle.color = option.series[seriesLineIndex].markArea.itemStyle.color ? option.series[seriesLineIndex].markArea.itemStyle.color : option.series[seriesLineIndex].lineStyle.color
        //             option.series[seriesLineIndex].markArea.itemStyle.borderWidth = 1
        //             option.series[seriesLineIndex].markArea.itemStyle.borderColor = option.series[seriesLineIndex].markArea.itemStyle.color ? option.series[seriesLineIndex].markArea.itemStyle.color : option.series[seriesLineIndex].lineStyle.color
        //         }
        //         option.series[seriesLineIndex].markArea.itemStyle.opacity = 0.3
        //     }
        //     if (option.series[seriesLineIndex].markPoint) {
        //         option.series[seriesLineIndex].markPoint.itemStyle = {
        //             color: 'rgb(255,178,178)'
        //         }
        //         option.series[seriesLineIndex].markPoint.itemStyle.opacity = 1
        //     }
        //     if (option.series[seriesLineIndex].areaStyle) {
        //         option.series[seriesLineIndex].areaStyle.opacity = 0.3
        //     }
        // } else {
        //     if (option.series[seriesLineIndex].markArea) {
        //         option.series[seriesLineIndex].markArea.itemStyle.opacity = 0
        //         // option.series[seriesLineIndex].markArea.itemStyle.color = 'rgba(0,0,0,0)'
        //     }
        //     if (option.series[seriesLineIndex].markPoint) {
        //         option.series[seriesLineIndex].markPoint.itemStyle = {}
        //         option.series[seriesLineIndex].markPoint.itemStyle.opacity = 0
        //     }
        //     if (option.series[seriesLineIndex].areaStyle) {
        //         option.series[seriesLineIndex].areaStyle.opacity = 0
        //     }
        // }
        chart.setOption(option, true)
        let selectedObj = {}
        selectedObj[e.target.name] = e.target.checked
        selectedObj[`${e.target.name}_polygonShadow`] = e.target.checked
        for (let [key, value] of dashedLineNameList.entries()) {
            if (key === e.target.name) {
                selectedObj[`${value}`] = e.target.checked
            }
        }
        chart.setOption({
            legend: {
                show: false,
                data: option.series.filter(item => item.name).map(item => item.name),
                selected: selectedObj
            }
        })
        echartsDataForRenderCheckBoxList.value = chart.getOption().series
    }
}

/**
 * selectBox切换线的颜色
*/
let handleChangeLineColor = (e: any, name: string) => {
    let { option, chart } = getOptionAndChart()
    let selectColor = e.target.value
    // 遍历当前图表series当item === name的时候就是要修改颜色线，同时修改checkBox线的颜色
    echartsDataForRenderCheckBoxList.value.map(item => {
        if (item.name === name) {
            item.selectedLineColor = option.color.findIndex(chartDefaultColorItem => chartDefaultColorItem === selectColor)
            item.lineStyle.color = option.color[item.selectedLineColor]
            item.itemStyle = {
                color: option.color[item.selectedLineColor]
            }
        }
    })
    option.series = echartsDataForRenderCheckBoxList.value
    chart.setOption(option)
    resetCheckBoxLineColor()
}

/**
 * 重置线的颜色
*/
let resetCheckBoxLineColor = () => {
    let { option } = getOptionAndChart()
    nextTick(() => {
        let lineDomBox = echartsOuterBoxDom.value.querySelectorAll('.lineRotate')
        const regex = /^line\d+$/;
        let chartsItemList = echartsDataForRenderCheckBoxList.value.filter(item => item.name).filter(item => item.name.indexOf('虚线_') === -1 && item.type !== 'custom').filter(item => item.name)
        for (let index = 0; index < lineDomBox.length; index++) {
            const item = lineDomBox[index];
            const chartsItem = chartsItemList[index];
            if (!chartsItem) {
                // 如果没有更多的 chartsItem，那么跳出循环。
                break;
            }
            // 获取当前元素的类名列表
            const classNames = Array.from(item.classList);
            // 遍历类名数组
            for (let className of classNames) {
                // 检查类名是否匹配正则表达式
                if (regex.test(className)) {
                    // 如果匹配，从元素的类列表中移除该类名
                    item.classList.remove(className);
                }
            }
            if (chartsItem.copyFlag) {
                let lineClassIndex = option.color.findIndex(colorDefaultItem => colorDefaultItem === chartsItem.lineStyle.color)
                item.classList.add(`line${lineClassIndex + 1}`)
            } else if (chartsItem?.selectedLineColor >= 0) {
                item.classList.add(`line${chartsItem.selectedLineColor + 1}`)
            } else {
                item.classList.add(`line${(index % 9) + 1}`)
            }
        }
    })
}
/**
 * 高亮散点函数
*/
function addOrUpdateEffectScatter(option, seriesLineIndex, chart) {
    // 查找是否存在 'effectScatter' 类型的系列
    const effectScatterIndex = option.series.findIndex(item => item.type === 'effectScatter');
    const highlightMarkPoint = option.series[seriesLineIndex].hightLightMarkPoint;

    if (highlightMarkPoint) {
        // 如果存在 'effectScatter' 系列，则更新它；否则，创建一个新的
        if (effectScatterIndex > -1) {
            option.series[effectScatterIndex] = effectScatterConfig;
        } else {
            option.series.push(effectScatterConfig);
        }
    } else if (effectScatterIndex > -1) {
        // 如果没有高亮点，并且存在 'effectScatter' 系列，则移除它
        option.series.splice(effectScatterIndex, 1);
    }

    // 更新图表配置
    chart.setOption(option);
}
// 高亮点的配置信息
const effectScatterConfig = {
    type: 'effectScatter',
    data: [{ value: null, symbolSize: 8 }],
    showEffectOn: 'render',
    rippleEffect: {
        brushType: 'stroke',
        number: 2,
        period: 3,
        scale: 5
    },
    symbol: 'diamond',
    itemStyle: {
        normal: {
            color: 'red',
            shadowBlur: 30,
            shadowColor: 'red'
        }
    },
    zlevel: 1
};
/**
 * 为每个checkBoxItem绑定hightLightAction
*/
let highlightedItems = new Set(); // 全局变量，用于存储已经添加监听器的元素
let hightLightAction = (getAllCopyFirst?: boolean) => {
    nextTick(() => {
        const allChartBoxItem = echartsOuterBoxDom.value.querySelectorAll('.checkItem');
        const checkBoxDomList = echartsOuterBoxDom.value.querySelectorAll('.checkBoxItem');
        if (getAllCopyFirst) {
            checkBoxDomList.forEach(item => {
                // 初始化每个checkBox的checked属性
                if (!item.checked) {
                    item.checked = true;
                }
            });
        }
        allChartBoxItem.forEach(item => {
            // 检查元素是否已经添加了监听器
            if (highlightedItems.has(item)) {
                removeExistingListeners(item);
                highlightedItems.delete(item);
            }
            // 添加新的监听器
            item.addEventListener('mouseover', () => {
                let { option, chart } = getOptionAndChart()
                let seriesLineIndex = option.series.findIndex(seriesItem => seriesItem.name === item.getAttribute('flagKey'));
                // (option.series[seriesLineIndex], 'option.series[seriesLineIndex]')
                if (option.series[seriesLineIndex].lineStyle && option.series[seriesLineIndex].lineStyle.width !== 0) {
                    option.series[seriesLineIndex].lineStyle.width = 4;
                    chart.setOption(option);
                    echartsDataForRenderCheckBoxList.value = chart.getOption().series
                }
                // 高亮点
                if (option.series[seriesLineIndex].hightLightMarkPoint) {
                    // 更新散点图的 value
                    effectScatterConfig.data[0].value = option.series[seriesLineIndex].hightLightMarkPoint;
                    effectScatterConfig.labelLayout = function () {
                        return {
                            x: 10,
                            verticalAlign: 'center'
                            // moveOverlap: 'y'
                        };
                    }
                    effectScatterConfig.labelLine = {
                        show: true,
                        length2: 3,
                        lineStyle: {
                            color: 'black'
                        }
                    },
                        effectScatterConfig.label = {
                            show: true,
                            formatter: function (param) {
                                return param.data[3];
                            },
                            position: 'left',
                            minMargin: 2
                        }
                    addOrUpdateEffectScatter(option, seriesLineIndex, chart);
                } else {
                    addOrUpdateEffectScatter(option, seriesLineIndex, chart);
                }
            });
            item.addEventListener('mouseleave', () => {
                let { option, chart } = getOptionAndChart()
                let seriesLineIndex = option.series.findIndex(seriesItem => seriesItem.name === item.getAttribute('flagKey'));
                if (option.series[seriesLineIndex].lineStyle && option.series[seriesLineIndex].lineStyle.width !== 0) {
                    option.series[seriesLineIndex].lineStyle.width = 2;
                    chart.setOption(option);
                    echartsDataForRenderCheckBoxList.value = chart.getOption().series
                }
                let seriesIndex = option.series.findIndex(item => item.type === 'effectScatter')
                if (seriesIndex > 0) {
                    option.series.splice(seriesIndex, 1)
                    chart.setOption(option, true)
                }
            });
            // 将元素添加到全局集合中
            highlightedItems.add(item);
        });
    });
}
function removeExistingListeners(item: any) {
    // 移除已经添加的监听器
    ['mouseover', 'mouseout'].forEach(eventType => {
        const existingListeners = item.__vueListeners || [];
        for (let i = 0; i < existingListeners.length; i++) {
            const listener = existingListeners[i];
            if (listener.event === eventType) {
                item.removeEventListener(eventType, listener.callback);
                item.__vueListeners = existingListeners.filter((l) => l !== listener);
                break;
            }
        }
    });
}

const copyCurveAction = async (copyLine: any) => {
    console.log(copyLine)
}
const deleteCurveAction = async (delLine: any) => {
    console.log(delLine)
}
const getCurveAction = async () => {
    let { option, chart } = getOptionAndChart()
    let code = 300
    if (code === 200) {
        resCurTabAllCopyLine.value = []
        resCurTabAllCopyLine.value = data.map(item => JSON.parse(item))
        // 合并复制线到当前渲染的checkBox中，但不能修改原来checkBox的状态
        // 拿到当前图表的历史copy并合并到checkBox的renderList中
        for (let i = echartsDataForRenderCheckBoxList.value.length - 1; i >= 0; i--) {
            if (echartsDataForRenderCheckBoxList.value[i].hasOwnProperty('copyFlag')) {
                echartsDataForRenderCheckBoxList.value.splice(i, 1);
            }
        }
        let sortCopyData = resCurTabAllCopyLine.value.sort(sortByNameGroupAndNumber)
        echartsDataForRenderCheckBoxList.value = [...echartsDataForRenderCheckBoxList.value, ...sortCopyData]
        echartsDataForRenderCheckBoxList.value.map(item => {
            if (item.copyShadowData) {
                item.copyShadowData.renderItem = echartsDataForRenderCheckBoxList.value.filter(item => item.type === 'custom').find(sourceShadow => sourceShadow.name === item.copyShadowData.sourceName).renderItem
                echartsDataForRenderCheckBoxList.value.push(item.copyShadowData)
            }
        })
        // 把这些数据按照索引绘制到图表中
        let echartsOption = props.chart.value ? props.chart.value.getOption() : props.chart.getOption()
        echartsOption.series = echartsDataForRenderCheckBoxList.value
        props.chart.value ? props.chart.value.setOption(echartsOption) : props.chart.setOption(echartsOption)
        echartsDataForRenderCheckBoxList.value = props.chart.value ? props.chart.value.getOption().series : props.chart.getOption().series
        resetCheckBoxLineColor()
        hightLightAction(false)
        draggable(echartsOuterBoxDom.value, checkBoxDom.value)
    }
}

/**
 * 重排copy接口的返回数据
*/
function sortByNameGroupAndNumber(a: any, b: any) {
    // 提取名字中的数字部分，用于后续比较
    const numberA = parseInt(a.name.match(/\d+/)[0]);
    const numberB = parseInt(b.name.match(/\d+/)[0]);

    // 首先比较名字的文本部分，如果相同，则比较数字部分
    if (a.name < b.name) {
        return -1;
    } else if (a.name > b.name) {
        return 1;
    } else {
        // 名字相同，比较数字部分
        if (numberA < numberB) {
            return -1;
        } else if (numberA > numberB) {
            return 1;
        } else {
            // 完全相同
            return 0;
        }
    }
}
function init() {
    let { option } = getOptionAndChart()
    echartsDataForRenderCheckBoxList.value = option.series
    echartThemeColorList.value = option.color
    hightLightAction(true)
    draggable(echartsOuterBoxDom.value, checkBoxDom.value)
    resetCheckBoxLineColor()
    showWhichLine()
}
onMounted(() => {
    setTimeout(() => {
        try {
            init()
            if (props.drawerFlag) {
                showChartCheckBox.value = false
            }
        } catch (e) {
            // console.error(e, 'init checkBox error')
        }
    }, 100)
})

/**
 * 如果图表切换时loading没有更变 则需要监听radioId
*/
watch(toRef(props, 'radioId'), (nV, oV) => {
    let { option } = getOptionAndChart()
    if (props.radioId > 200) {
        nextTick(() => {
            echartsDataForRenderCheckBoxList.value = []
            echartsDataForRenderCheckBoxList.value = option.series
            echartThemeColorList.value = option.color
            // 获取历史copyLine
            getCurveAction()
        })
    }
})

/**
 * 判断图表数据是否更新
*/
watch(toRef(props, 'loading'), (nVal: boolean, oVal: boolean) => {
    let { option } = getOptionAndChart()
    echartsDataForRenderCheckBoxList.value = []
    if (!nVal) {
        // 要渲染的checkBox列表
        echartsDataForRenderCheckBoxList.value = option.series
        echartThemeColorList.value = option.color
        // 获取历史copyLine
        getCurveAction()
        showWhichLine()
    }
})
/**
 * 更新checkBoxList
*/
function upDateCheckBoxList() {
    let { option } = getOptionAndChart()
    echartsDataForRenderCheckBoxList.value = option.series
    resetCheckBoxLineColor()
    hightLightAction(false)
}
/**
 * 更新chart
*/
function upDateChart(cover: boolean) {
    let { chart } = getOptionAndChart()
    chart.setOption(echartsDataForRenderCheckBoxList.value, cover)
}
defineExpose({
    upDateCheckBoxList,
    upDateChart
})
</script>
<template>
    <div class="container" ref="echartsOuterBoxDom">
        <!-- 右上角的iconBox 用来开关echartsCheckBox-->
        <div class="rightTopIconForChartCheckBox" @click="() => showChartCheckBox = !showChartCheckBox"
            v-if="showControlBtn" :title="getLanguage('ShowHidelegend')"></div>
        <div class="chartCheckBox" ref="checkBoxDom" v-show="showChartCheckBox">
            <div class="checkItemUl">
                <div class="checkItem"
                    v-for="(itemLine, lineIndex) in echartsDataForRenderCheckBoxList.filter(item => item.name && item.type !== 'custom' && item.name.indexOf('虚线') === -1)"
                    :key="lineIndex" :flagKey="itemLine.name">
                    <div class="leftCheckBox">
                        <label style="border: none;">
                            <input type="checkbox" class="checkBoxItem" :name="itemLine.name"
                                :checked="itemLine.lineStyle?.width > 0" />
                            <span class="custom-checkbox"></span>
                        </label>
                        <div class="line lineRotate"></div>
                        <select :id="itemLine.name" :name="itemLine.name" class="selectLineColor"
                            style="position:relative;left:18px;top:-2px;"
                            @change="handleChangeLineColor($event, itemLine.name)">
                            <option v-for="(color, colorIdx) in echartThemeColorList" :key="color" :value="color"
                                :selected="itemLine.copyFlag ? itemLine.firstColorIndex === colorIdx : lineIndex === colorIdx"
                                :style="{ backgroundColor: color, width: '5px', height: '5px' }">
                            </option>
                        </select>
                        <span class="lineName font-light">{{ itemLine.name }}</span>
                    </div>
                    <div class="rightEditBox" v-if="echartThemeColorList.length">
                        <div :class="[itemLine.copyFlag ? 'delIcon' : 'copyIcon']" @click="($events) => {
                            if (!itemLine.copyFlag) {
                                renameInput.tabIndex = -1
                                renameInput.focus()
                            }

                            handleCopyAndDel(lineIndex, itemLine.copyFlag, itemLine)
                        }"></div>
                    </div>
                </div>
            </div>
            <div class="doubleConfirmCopyRenameBox" v-show="showDoubleConfirmCopyRenameBox"
                ref="doubleConfirmCopyRenameBox">
                <span class="title" style="font-size:x-small;"> {{ getLanguage('rename') }} :</span>
                <input class="renameInput" ref="renameInput" type="text" v-model="copyLineRename.name"
                    @focus="(e) => e.target.select()">
                <button class="btn" @click="handleClickSure"> {{ getLanguage('ok') }} </button>
            </div>
        </div>
    </div>
</template>
<style lang="scss" scoped>
.container {
    width: 100%;
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
    pointer-events: none;

    .rightTopIconForChartCheckBox {
        position: absolute;
        right: 0;
        top: 0;
        width: 21px;
        height: 20px;
        background-image: url('@/assets/img/copy/showAndHide.png');
        background-position: center center;
        z-index: 2;
        cursor: pointer;
        pointer-events: auto;
    }

    .chartCheckBox {
        width: 287.5px;
        background: #FFFFFF;
        box-shadow: 0px 5px 20px -2px rgba(76, 76, 76, 0.35);
        border-radius: 5px;
        position: absolute;
        right: 0;
        top: 24px;
        z-index: 100;
        max-height: 600px;
        pointer-events: auto;


        .checkItemUl {
            position: relative;
            width: 100%;
            max-height: 500px;
            overflow-y: auto;
            border: 2px solid #CCD4DD;

            .checkItem {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 5px;

                .leftCheckBox {
                    user-select: none;
                    width: 80%;

                    // 复刻LandMark的选择框
                    /* 默认的checkbox样式 */
                    input[type="checkbox"].checkBoxItem {
                        width: 20px;
                        height: 20px;
                        border: 1px solid #979797FF;
                        background-color: #fff;
                        /* 默认背景色 */
                        cursor: pointer;
                        position: absolute;
                        appearance: none;
                        -webkit-appearance: none;
                        -moz-appearance: none;
                        border-radius: 5px;
                        margin-top: 5px;
                    }

                    /* When the checkbox is checked, change the background color */
                    input[type="checkbox"].checkBoxItem:checked {
                        background: #7cae43FF;
                        /* 选中后的背景色 */
                    }

                    /* 自定义样式的复选框容器 */
                    .custom-checkbox {
                        display: inline-block;
                        width: 20px;
                        height: 20px;
                        border: 1px solid #ccc;
                        position: relative;
                        border-radius: 5px;
                        margin-top: 5px;
                    }

                    /* 当复选框被选中时，显示对号 */
                    .custom-checkbox::after {
                        content: "✔";
                        display: none;
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        color: white;
                        /* 对号颜色 */
                        font-size: 14px;
                    }

                    input[type="checkbox"].checkBoxItem:checked+.custom-checkbox::after {
                        display: block;
                        /* 选中后显示对号 */
                    }

                    .lineName {
                        font-size: 14px;
                        line-height: 27px;
                        position: relative;
                        top: -3px;
                        left: 20px;
                    }
                }

                .rightEditBox {
                    display: flex;
                    align-items: center;
                }

                .copyIcon {
                    width: 17px;
                    height: 16px;
                    background-image: url('@/assets/img/copy/copy.png');
                    background-position: center center;
                    background-size: cover;
                    cursor: pointer;
                }

                .delIcon {
                    width: 17px;
                    height: 16px;
                    background-image: url('@/assets/img/copy/noCopy.png');
                    background-position: center center;
                    background-size: cover;
                    cursor: pointer;
                }
            }
        }
    }

    .doubleConfirmCopyRenameBox {
        // position: absolute;
        width: 100%;
        height: 40px;
        background: black;
        opacity: 0.7;
        border-radius: 5px;

        display: flex;
        justify-content: space-around;
        align-items: center;
        pointer-events: auto;

        .title {
            color: white;
        }

        .renameInput {
            pointer-events: auto;
        }

        .btn {
            pointer-events: auto;
            z-index: 1;
        }
    }

    select:focus {
        outline: none;
    }

    $colors: #d20000ff, #FFA500FF, #00FF00FF, #0091FFFF, #6236FFFF, #068B86FF, #FD00FCFF, #A95F5FFF, #ea7ccc;
    $angles: 70deg, 70deg, 70deg, 70deg, 70deg, 70deg, 70deg, 70deg, 70deg;

    @for $i from 1 through length($colors) {
        .line#{$i} {
            position: relative;
            display: inline-block;

            &::before {
                content: "";
                position: absolute;
                top: -20px;
                left: 13px;
                width: 1px;
                height: 20px;
                background-color: nth($colors, $i);
                transform: rotate(nth($angles, $i));
            }

            &:hover::before {
                width: 2px;
                height: 20px;
            }
        }
    }
}
</style>