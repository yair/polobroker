for (( ; ; ))
do
	nodejs polobroker.js 2>&1 | tee runlog_`date -u +"%Y-%m-%dT%H:%M:%SZ"`
done
