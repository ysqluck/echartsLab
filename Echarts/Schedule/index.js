//格式化时间
function formatDate(date) {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1);
    let day = `${date.getDate()}`;
    let week = ['星期天', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
    return `${year}-${month}-${day}-${week}`
};

//获取表格当前第一天的日期
function getCurrentWeekFirstDay(formatterData) {
    return `${formatterData[0].split('-')[0]}-${formatterData[0].split('-')[1]}-${formatterData[0].split('-')[2]}`
}

//获取表格当前最后一天日期
function getCurrentWeekLastDay(formatterData) {
    return `${formatterData[6].split('-')[0]}-${formatterData[6].split('-')[1]}-${formatterData[6].split('-')[2]}`
}

//设置日期
function setDate(date) {
    let week = date.getDay() - 1;
    date = addDate(date, week * -1);
    currentFirstDate = new Date(date);
    let arr = []
    for (let i = 0; i < 7; i++) {
        arr.push(formatDate(i == 0 ? date : addDate(date, 1)))
    }
    return arr
};

//获取日期
function addDate(date, n) {
    date.setDate(date.getDate() + n);
    return date;
};

// 时间戳转成天数
function dateToDay(time1, time2) {
    if ((+new Date(time2) - (+new Date(time1))) / (1000 * 3600 * 24) > 0) {
        return Math.round((+new Date(time2) - (+new Date(time1))) / (1000 * 3600 * 24))
    } else {
        return Math.abs((+new Date(time2) - (+new Date(time1))) / (1000 * 3600 * 24))
    }
};

function handle(projectSchedule) {
    option.series[0].data = []
    option.series[1].data = []
    serisedata = []
    for (let i = 0; i < projectSchedule.length; i++) {
        let projectStartTime = +new Date(projectSchedule[i].startDate) //项目开始时间
        let projectEndTime = +new Date(projectSchedule[i].endDate)  //项目结束时间
        // 判断项目的开始时间是否与当前周开始时间相同
        let isSameStartTime = +new Date(projectStartTime) === (+new Date(getCurrentWeekFirstDay(formatterData)))
        if (isSameStartTime) {
            serisedata.push({
                length: dateToDay(projectStartTime, projectEndTime) + 1,
                start: 0,
                name: projectSchedule[i].name,
                totalDays:dateToDay(projectStartTime, projectEndTime)+1
            })
        } else {
            // 如果不相同
            // 1. 项目开始时间小于当前周的开始时间
            if (+new Date(projectStartTime) < (+new Date(getCurrentWeekFirstDay(formatterData)))) {
                if (+new Date(projectEndTime) >= (+new Date(getCurrentWeekFirstDay(formatterData)))) {
                    // 如果项目的结束时间大于等于本周的开始时间
                    serisedata.push({
                        length: dateToDay(getCurrentWeekFirstDay(formatterData), projectEndTime) + 1,
                        start: 0,
                        name: projectSchedule[i].name,
                        totalDays:dateToDay(projectStartTime, projectEndTime)+1
                    })
                }
            }
            // 2. 项目开始时间大于当前周的开始时间
            if (+new Date(projectStartTime) > (+new Date(getCurrentWeekFirstDay(formatterData)))) {
                serisedata.push({
                    length: dateToDay(projectStartTime, projectEndTime) + 1,
                    start: dateToDay(+new Date(getCurrentWeekFirstDay(formatterData)), new Date(projectStartTime)),
                    name: projectSchedule[i].name,
                    totalDays:dateToDay(projectStartTime, projectEndTime)+1
                })
                if (dateToDay(+new Date(getCurrentWeekFirstDay(formatterData)), new Date(projectStartTime)) > 6) {
                    // 避免项目的开始日期在当前周的结束日期之后，占位符依旧被使用的问题
                    return
                }
            }
        }
        option.series[0].data = serisedata.map(item => {
            return { value: item.start }
        })
        option.series[1].data = serisedata.map(item => {
            return {
                value: item.length,
                name: item.name,
                totalDays:item.totalDays
            }
        })
        // 动态修改Title
        option.title.text = `${formatterData[0].split('-')[1]}月`
    }
}